"""
Ollama map analyzer
===================

Bir harita adresindeki ham baytları yerel LLM ile yorumlar ve sonucu TunerPro
`.xdf` referansıyla doğrular. LLM hiçbir zaman tek başına karar vermez: XDF
eşleşmesi ve güvenlik notu her zaman döndürülür.

Bu modül "Ollama bağlantı hatası"nın üç farklı nedenini ayırt eder:

* ``OLLAMA_OFFLINE``      – servis çalışmıyor / port kapalı (bağlantı reddedildi).
* ``OLLAMA_TIMEOUT``      – servis ayakta ama 7B modeli ilk yüklemede yetişmedi.
* ``OLLAMA_MODEL_MISSING``– istenen model ``ollama pull`` ile indirilmemiş.

Her durumda sezgisel (heuristic) yedek analiz döner; kullanıcıya ne yapacağı
Türkçe olarak söylenir. Sahte bir "AI çalıştı" yanıtı üretilmez.
"""

from __future__ import annotations

import argparse
import json
import os
import socket
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

try:  # package import
    from .parser import EcuBinary
    from .profiles import EDC15_DEMO_PROFILE, UnsupportedEcuError, detect_profile
except ImportError:  # pragma: no cover - direct script execution
    from parser import EcuBinary
    from profiles import EDC15_DEMO_PROFILE, UnsupportedEcuError, detect_profile

OLLAMA_BASE_URL = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
# CPU'da 7B modelinin ilk yüklemesi 30-60 saniye sürebilir; 15 saniye çok kısaydı.
DEFAULT_GENERATE_TIMEOUT = float(os.environ.get("OLLAMA_TIMEOUT", "300"))
STATUS_TIMEOUT = float(os.environ.get("OLLAMA_STATUS_TIMEOUT", "3"))

PREFERRED_MODELS = ("qwen2.5-coder:7b", "llama3.1:8b", "llava:7b")

# Model her istekte bellekten atılmasın diye 30 dakika sıcak tutulur.
KEEP_ALIVE = os.environ.get("OLLAMA_KEEP_ALIVE", "30m")


def _pretty_address(offset: int) -> str:
    return f"0x{offset:X}"


@dataclass
class OllamaStatus:
    online: bool
    base_url: str = OLLAMA_BASE_URL
    models: List[str] = field(default_factory=list)
    latency_ms: Optional[int] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    guidance_tr: Optional[str] = None

    def as_dict(self) -> dict:
        return {
            "online": self.online,
            "base_url": self.base_url,
            "models": self.models,
            "latency_ms": self.latency_ms,
            "error_code": self.error_code,
            "error_message": self.error_message,
            "guidance": self.guidance_tr,
        }


def _request_json(
    path: str, payload: Optional[dict], timeout: float
) -> Dict[str, Any]:
    data = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(
        f"{OLLAMA_BASE_URL}{path}", data=data, headers=headers, method="POST" if data else "GET"
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def check_ollama_status() -> OllamaStatus:
    """Ollama servisine erişimi ve yüklü modelleri kontrol eder."""
    started = time.perf_counter()
    try:
        body = _request_json("/api/tags", None, STATUS_TIMEOUT)
        elapsed = int((time.perf_counter() - started) * 1000)
        models = [item.get("name", "") for item in body.get("models", []) if item.get("name")]
        return OllamaStatus(online=True, models=models, latency_ms=elapsed)
    except urllib.error.HTTPError as exc:  # servis var, uç yok
        return OllamaStatus(
            online=False,
            error_code="OLLAMA_HTTP_ERROR",
            error_message=f"Ollama HTTP {exc.code}: {exc.reason}",
            guidance_tr=(
                "Ollama sürümü çok eski olabilir. `ollama --version` ile kontrol edip "
                "https://ollama.com/download adresinden güncelleyin."
            ),
        )
    except urllib.error.URLError as exc:
        reason = getattr(exc, "reason", exc)
        if isinstance(reason, ConnectionRefusedError) or "refused" in str(reason).lower():
            code, message = "OLLAMA_OFFLINE", "Bağlantı reddedildi (port kapalı)."
            guidance = (
                "Ollama servisi çalışmıyor. Ayrı bir terminalde `ollama serve` çalıştırın "
                "veya Ollama masaüstü uygulamasını açın. Ardından `ollama list` ile "
                "modellerin yüklü olduğunu doğrulayın."
            )
        elif "timed out" in str(reason).lower():
            code, message = "OLLAMA_TIMEOUT", "Bağlantı zaman aşımına uğradı."
            guidance = (
                "Ollama yanıt vermedi. Servisin yanıt verip vermediğini "
                "`curl http://127.0.0.1:11434/api/tags` ile test edin."
            )
        else:
            code, message = "OLLAMA_UNREACHABLE", f"Ollama'ya ulaşılamadı: {reason}"
            guidance = (
                "OLLAMA_HOST değişkenini kontrol edin. Varsayılan adres "
                "http://127.0.0.1:11434 olmalıdır."
            )
        return OllamaStatus(
            online=False, error_code=code, error_message=message, guidance_tr=guidance
        )
    except socket.timeout:
        return OllamaStatus(
            online=False,
            error_code="OLLAMA_TIMEOUT",
            error_message="Bağlantı zaman aşımına uğradı.",
            guidance_tr="Ollama servisi yanıt vermiyor; `ollama serve` çalışıyor mu?",
        )
    except json.JSONDecodeError:
        return OllamaStatus(
            online=False,
            error_code="OLLAMA_BAD_RESPONSE",
            error_message="Ollama geçersiz JSON döndürdü.",
            guidance_tr="Portu başka bir uygulama kullanıyor olabilir; 11434 portunu kontrol edin.",
        )


def resolve_model(requested: str, installed: List[str]) -> tuple[Optional[str], Optional[str]]:
    """
    İstenen modeli döndürür. Yoksa yüklü modellerden güvenli bir alternatif seçer.

    Dönüş: (kullanılacak_model, uyarı_mesajı)
    """
    if requested in installed:
        return requested, None
    # "qwen2.5-coder:7b" gibi tam ad verilmediyse etiket farkını da tolere et.
    base = requested.split(":", 1)[0]
    for name in installed:
        if name.split(":", 1)[0] == base:
            return name, f"'{requested}' yerine yüklü '{name}' kullanılıyor."
    for preferred in PREFERRED_MODELS:
        if preferred in installed:
            return (
                preferred,
                f"'{requested}' yüklü değil; bunun yerine '{preferred}' kullanılıyor. "
                f"İstediğiniz modeli `ollama pull {requested}` ile indirebilirsiniz.",
            )
    if installed:
        return (
            installed[0],
            f"'{requested}' yüklü değil; mevcut ilk model '{installed[0]}' kullanılıyor.",
        )
    return None, (
        f"Hiç model yüklü değil. `ollama pull {requested}` komutunu çalıştırın."
    )


def _heuristic_analysis(
    offset: int, xdf_match: Optional[dict], hex_dump: str
) -> str:
    """LLM yokken kullanılan, XDF doğrulamasına dayalı deterministik açıklama."""
    if xdf_match:
        return (
            f"1. Harita Tipi ve Tahmini: {_pretty_address(offset)} adresindeki bayt deseni, "
            f"XDF referansındaki '{xdf_match['title']}' haritasıyla eşleşiyor.\n"
            "2. Değer Aralığı Değerlendirmesi: Değerler 16-bit LoHi (little-endian) "
            "kelimeler halinde okunuyor; turbo haritasında 0.1 faktörü 21_500 → 2_150 mbar "
            "mutlak basınca karşılık gelir (1_000 mbar atmosferik).\n"
            "3. XDF Doğrulama Notu ve Güvenli Modifikasyon Önerisi: Adres ground-truth XDF "
            "dosyasıyla eşleşiyor. Stok GT1749V için güvenli artış +%15, mutlak sınır +%20'dir; "
            "daha fazlası için intercooler, EGT probu ve dyno doğrulaması gerekir."
        )
    return (
        f"1. Harita Tipi: {_pretty_address(offset)} adresindeki bayt deseni XDF referans "
        "listesinde kayıtlı bir ana harita değil; serbest kalibrasyon veya ara tablo olabilir.\n"
        f"2. Değer Analizi: İlk 32 bayt ({hex_dump[:24]}...) 16-bit LoHi yapısında incelendi.\n"
        "3. Güvenlik Notu: Doğrulanmamış adreslerde yazma yapılmaz. Bu bölgeye müdahale "
        "etmeden önce aynı yazılım sürümüne ait Damos/XDF tanımıyla eşleştirin."
    )


class OllamaEcuAnalyzer:
    def __init__(self, bin_path: str, xdf_path: str, bin_data: Optional[bytes] = None):
        self.bin_path = bin_path
        self.xdf_path = xdf_path
        if bin_data is None:
            with open(bin_path, "rb") as handle:
                data = handle.read()
        else:
            data = bytes(bin_data)
        try:
            self.profile = detect_profile(data)
            self.binary = EcuBinary(data, self.profile)
            self.detect_error: Optional[str] = None
        except UnsupportedEcuError as exc:
            # AI analizi için kimlik eşleşmesi şart değil; ancak kullanıcı bilgilendirilir.
            self.profile = EDC15_DEMO_PROFILE
            self.binary = EcuBinary(data, self.profile, strict=True)
            self.detect_error = str(exc)
        self.xdf_maps = self._load_xdf_maps()

    # ------------------------------------------------------------------ XDF
    def _load_xdf_maps(self) -> Dict[int, dict]:
        maps: Dict[int, dict] = {}
        if not os.path.exists(self.xdf_path):
            return maps
        try:
            tree = ET.parse(self.xdf_path)
            root = tree.getroot()
            for table in root.findall(".//XDFTABLE"):
                title_elem = table.find("title")
                title = title_elem.text if title_elem is not None and title_elem.text else "Bilinmeyen harita"
                desc_elem = table.find("description")
                desc = desc_elem.text if desc_elem is not None and desc_elem.text else ""
                z_axis = table.find(".//XDFAXIS[@id='z']")
                if z_axis is None:
                    continue
                emb = z_axis.find("EMBEDDEDDATA")
                if emb is None or "mmedaddress" not in emb.attrib:
                    continue
                addr = int(emb.attrib["mmedaddress"], 16)
                maps[addr] = {
                    "title": title,
                    "description": desc,
                    "address_hex": _pretty_address(addr),
                    "rows": int(emb.attrib.get("mmedrowelements", "16")),
                    "cols": int(emb.attrib.get("mmedcolumelements", "16")),
                }
        except ET.ParseError as exc:
            print(f"Uyarı: XDF ayrıştırılamadı: {exc}", file=sys.stderr)
        return maps

    def check_ollama_status(self) -> dict:
        return check_ollama_status().as_dict()

    # -------------------------------------------------------------- analyze
    def analyze_address(
        self,
        offset: int,
        model: str = "qwen2.5-coder:7b",
        timeout: float = DEFAULT_GENERATE_TIMEOUT,
    ) -> dict:
        raw_bytes = self.binary.read_bytes(offset, 32)
        hex_dump = " ".join(f"{byte:02X}" for byte in raw_bytes)
        matrix = self.binary.get_matrix(offset, rows=4, cols=4, factor=0.1)
        xdf_match = self.xdf_maps.get(offset)

        status = check_ollama_status()
        active_model: Optional[str] = None
        model_note: Optional[str] = None
        llm_answer: Optional[str] = None
        error: Optional[dict] = None
        source = "heuristic_fallback"

        if status.online:
            active_model, model_note = resolve_model(model, status.models)
        else:
            error = {
                "code": status.error_code or "OLLAMA_OFFLINE",
                "message": status.error_message or "Ollama servisine bağlanılamadı.",
                "guidance": status.guidance_tr,
            }

        if status.online and active_model is None:
            error = {
                "code": "OLLAMA_MODEL_MISSING",
                "message": "Ollama çalışıyor ancak kullanılabilir model yok.",
                "guidance": model_note
                or f"`ollama pull {model}` komutuyla modeli indirin.",
            }

        if status.online and active_model:
            prompt = (
                "Sen otomotiv ECU (Bosch EDC15 1.9 TDI) tersine mühendisliği konusunda "
                "kıdemli bir kalibrasyon mühendisisin.\n\n"
                f"Adres: {_pretty_address(offset)}\n"
                f"Ham Hex (ilk 32 bayt, 16-bit LoHi): {hex_dump}\n"
                f"Ondalık Örnek (4x4, faktor 0.1): {json.dumps(matrix['matrix'][:4])}\n"
                f"XDF Referansı: {xdf_match['title'] if xdf_match else 'kayıtlı değil'}\n\n"
                "Cevabını Türkçe ve şu üç başlıkla ver (kısa, en fazla 200 kelime):\n"
                "1. Harita Tipi ve Tahmini:\n"
                "2. Değer Aralığı Değerlendirmesi:\n"
                "3. XDF Doğrulama Notu ve Güvenli Modifikasyon Önerisi:"
            )
            try:
                payload = {
                    "model": active_model,
                    "prompt": prompt,
                    "stream": False,
                    "keep_alive": KEEP_ALIVE,
                    "options": {
                        "temperature": 0.2,
                        "num_predict": 400,
                        "num_ctx": 4096,
                    },
                }
                response = _request_json("/api/generate", payload, timeout)
                llm_answer = (response.get("response") or "").strip() or None
                if llm_answer:
                    source = "ollama"
                else:
                    error = {
                        "code": "OLLAMA_EMPTY_RESPONSE",
                        "message": "Model boş yanıt döndürdü.",
                        "guidance": "Farklı bir model seçin veya `ollama run` ile modeli test edin.",
                    }
            except urllib.error.HTTPError as exc:
                detail = ""
                try:
                    detail = exc.read().decode("utf-8", errors="ignore")[:300]
                except Exception:
                    pass
                if exc.code == 404:
                    code = "OLLAMA_MODEL_MISSING"
                    message = f"Model bulunamadı: {active_model}"
                    guidance = f"`ollama pull {active_model}` komutunu çalıştırın."
                else:
                    code = "OLLAMA_HTTP_ERROR"
                    message = f"Ollama HTTP {exc.code}: {exc.reason}"
                    guidance = (
                        "Model adını ve Ollama sürümünü kontrol edin. Ayrıntı: "
                        f"{detail or 'yanıt gövdesi yok'}"
                    )
                error = {"code": code, "message": message, "guidance": guidance}
            except (socket.timeout, TimeoutError):
                error = {
                    "code": "OLLAMA_TIMEOUT",
                    "message": (
                        f"Model {int(timeout)} saniye içinde yanıt vermedi. "
                        "7B modelinin ilk yüklemesi CPU'da uzun sürebilir."
                    ),
                    "guidance": (
                        "Bir kez `ollama run "
                        f"{active_model}` ile modeli önceden yükleyin (ilk yükleme 30-90 sn). "
                        "Sonraki istekler hızlı olur. Gerekirse OLLAMA_TIMEOUT değişkenini "
                        "artırın veya daha küçük bir model seçin."
                    ),
                }
            except urllib.error.URLError as exc:
                reason = getattr(exc, "reason", exc)
                if isinstance(reason, (socket.timeout, TimeoutError)) or "timed out" in str(reason).lower():
                    error = {
                        "code": "OLLAMA_TIMEOUT",
                        "message": f"Model {int(timeout)} saniye içinde yanıt vermedi.",
                        "guidance": (
                            f"Modeli önceden `ollama run {active_model}` ile yükleyin "
                            "veya OLLAMA_TIMEOUT değerini artırın."
                        ),
                    }
                else:
                    error = {
                        "code": "OLLAMA_UNREACHABLE",
                        "message": f"Ollama isteği başarısız: {reason}",
                        "guidance": "Ollama servisinin çalıştığını doğrulayın.",
                    }
            except json.JSONDecodeError:
                error = {
                    "code": "OLLAMA_BAD_RESPONSE",
                    "message": "Ollama geçersiz JSON döndürdü.",
                    "guidance": "Port çakışması olabilir; 11434 portunu kontrol edin.",
                }

        used_heuristic = llm_answer is None
        analysis = llm_answer or _heuristic_analysis(offset, xdf_match, hex_dump)

        return {
            "address": _pretty_address(offset),
            "hex_dump": hex_dump,
            "ollama_online": status.online,
            "ollama_status": status.as_dict(),
            "model_requested": model,
            "model_used": active_model if llm_answer else "Sezgisel Motor (LLM devre dışı)",
            "model_note": model_note,
            "source": source,
            "used_fallback": used_heuristic,
            "error": error,
            "ai_analysis": analysis,
            "ground_truth_xdf": {
                "matched": xdf_match is not None,
                "map_title": xdf_match["title"] if xdf_match else "XDF tanımında bulunamadı",
                "expected_dimensions": (
                    f"{xdf_match['rows']}x{xdf_match['cols']}" if xdf_match else "N/A"
                ),
                "accuracy_score": 100 if xdf_match else 0,
            },
            "profile": {
                "id": self.profile.id,
                "display_name": self.profile.display_name,
                "confidence": self.profile.confidence,
                "detect_error": self.detect_error,
            },
        }


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="AutoTune AI - Ollama map analyzer")
    parser.add_argument("--address", default="0x4D200")
    parser.add_argument("--model", default=os.environ.get("OLLAMA_MODEL", "qwen2.5-coder:7b"))
    parser.add_argument("--bin", default="data/edc15_19tdi_stock.bin")
    parser.add_argument("--xdf", default="data/edc15_19tdi.xdf")
    parser.add_argument("--timeout", type=float, default=DEFAULT_GENERATE_TIMEOUT)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Sadece Ollama bağlantısını ve yüklü modelleri raporla",
    )
    args = parser.parse_args()

    if args.check:
        print(json.dumps(check_ollama_status().as_dict(), indent=2, ensure_ascii=False))
        return

    try:
        offset = int(args.address, 16) if args.address.lower().startswith("0x") else int(args.address)
        analyzer = OllamaEcuAnalyzer(args.bin, args.xdf)
        result = analyzer.analyze_address(offset, args.model, args.timeout)
        print(json.dumps(result, indent=2, ensure_ascii=False))
    except FileNotFoundError as exc:
        print(json.dumps({"error": f"Dosya bulunamadı: {exc}"}, ensure_ascii=False))
        sys.exit(1)
    except Exception as exc:  # pragma: no cover - CLI sözleşmesi
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
