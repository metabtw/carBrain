"""
AutoTune AI -- FastAPI core engine
==================================

Run locally:
    uvicorn backend.main:app --reload --port 8000
or:
    python backend/main.py

The Next.js UI can either call this service directly or use the small CLI
bridges in ``app/api``.  Both paths go through the same modules:

    parser.py     -> read/validate .bin
    guardrails.py -> reject dangerous tunes
    modifier.py   -> NumPy matrix scaling
    checksum.py   -> seal + verify before export
"""

from __future__ import annotations

import hashlib
import os
import sys
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

# Allow `uvicorn backend.main:app` and `python backend/main.py`.
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

try:  # package imports when run as `backend.main`
    from .checksum import ChecksumEngine, ChecksumError
    from .datalogger import analyze_csv
    from .guardrails import GuardrailEngine, SafetyViolation, TuningRequest
    from .modifier import ModificationError, apply_tuning
    from .parser import EcuBinary
    from .profiles import (
        EDC15_DEMO_PROFILE,
        EcuProfile,
        UnsupportedEcuError,
        detect_profile,
    )
except ImportError:  # pragma: no cover - direct script execution
    from checksum import ChecksumEngine, ChecksumError
    from datalogger import analyze_csv
    from guardrails import GuardrailEngine, SafetyViolation, TuningRequest
    from modifier import ModificationError, apply_tuning
    from parser import EcuBinary
    from profiles import (
        EDC15_DEMO_PROFILE,
        EcuProfile,
        UnsupportedEcuError,
        detect_profile,
    )

DATA_DIR = os.path.join(PROJECT_ROOT, "data")
STOCK_BIN_PATH = os.path.join(DATA_DIR, "edc15_19tdi_stock.bin")
MAX_UPLOAD_BYTES = 4 * 1024 * 1024
MAX_HISTORY = 20

app = FastAPI(
    title="AutoTune AI - ECU Çekirdek Motoru",
    description=(
        "Bosch EDC15 ikili dosya ayrıştırıcı, NumPy matris motoru, "
        "checksum imzalama ve mühendislik güvenlik bekçisi."
    ),
    version="2.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Session state
# ---------------------------------------------------------------------------
@dataclass
class SessionState:
    base: bytes
    working: bytes
    profile: EcuProfile
    original_name: str
    params: Dict[str, float] = field(
        default_factory=lambda: {"turbo": 0.0, "injection": 0.0, "throttle": 0.0}
    )
    history: List[dict] = field(default_factory=list)

    @property
    def lock(self) -> threading.Lock:  # replaced per instance in __post_init__
        return self._lock

    def __post_init__(self) -> None:
        self._lock = threading.Lock()


SESSION: Optional[SessionState] = None
SESSION_LOCK = threading.Lock()


def _load_stock() -> bytes:
    if not os.path.exists(STOCK_BIN_PATH):
        raise HTTPException(
            status_code=500,
            detail=(
                "Stok .bin dosyası bulunamadı. `python backend/generate_edc15_data.py` "
                "ile demo dosyasını üretebilirsiniz."
            ),
        )
    with open(STOCK_BIN_PATH, "rb") as handle:
        return handle.read()


def _new_session(data: bytes, profile: EcuProfile, name: str) -> SessionState:
    session = SessionState(
        base=bytes(data),
        working=bytes(data),
        profile=profile,
        original_name=name,
    )
    _add_history(session, "Orijinal dosya (stok)", bytes(data))
    return session


def get_session() -> SessionState:
    global SESSION
    with SESSION_LOCK:
        if SESSION is None:
            data = _load_stock()
            profile = detect_profile(data)
            SESSION = _new_session(data, profile, os.path.basename(STOCK_BIN_PATH))
        return SESSION


def _add_history(session: SessionState, label: str, data: bytes) -> None:
    version = len(session.history) + 1
    session.history.append(
        {
            "id": f"v{version}",
            "label": label,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "size": len(data),
            "sha256_prefix": hashlib.sha256(data).hexdigest()[:12],
            "data": bytes(data),
        }
    )
    # keep memory bounded; never drop v1 (original)
    if len(session.history) > MAX_HISTORY:
        del session.history[1]


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class TuneInput(BaseModel):
    turbo: float = 0.0
    injection: float = 0.0
    throttle: float = 0.0
    turbo_pct: Optional[float] = None
    injection_pct: Optional[float] = None
    throttle_pct: Optional[float] = None
    timing_advance_deg: Optional[float] = None
    rail_pressure_bar: Optional[float] = None
    ambient_temp_c: float = 25.0
    intake_air_temp_c: Optional[float] = None
    hardware_upgrades: List[str] = Field(default_factory=list)

    def to_request(self) -> TuningRequest:
        return TuningRequest(
            turbo_pct=self.turbo_pct if self.turbo_pct is not None else self.turbo,
            injection_pct=(
                self.injection_pct if self.injection_pct is not None else self.injection
            ),
            throttle_pct=(
                self.throttle_pct if self.throttle_pct is not None else self.throttle
            ),
            timing_advance_deg=self.timing_advance_deg,
            rail_pressure_bar=self.rail_pressure_bar,
            ambient_temp_c=self.ambient_temp_c,
            intake_air_temp_c=self.intake_air_temp_c,
            hardware_upgrades=self.hardware_upgrades,
        )


# ---------------------------------------------------------------------------
# Exception handlers: always return actionable Turkish engineering messages
# ---------------------------------------------------------------------------
@app.exception_handler(SafetyViolation)
async def safety_handler(request: Request, exc: SafetyViolation) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": "SAFETY_VIOLATION",
            "detail": str(exc),
            "safety": exc.as_dict(),
        },
    )


@app.exception_handler(UnsupportedEcuError)
async def unsupported_handler(request: Request, exc: UnsupportedEcuError) -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content={
            "success": False,
            "error": "UNSUPPORTED_ECU",
            "reason": exc.reason,
            "detail": str(exc),
        },
    )


@app.exception_handler(ChecksumError)
async def checksum_handler(request: Request, exc: ChecksumError) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "CHECKSUM_ERROR",
            "code": exc.code,
            "detail": str(exc),
        },
    )


@app.exception_handler(ModificationError)
async def modification_handler(request: Request, exc: ModificationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": "MODIFICATION_REJECTED",
            "code": exc.code,
            "detail": str(exc),
        },
    )


# ---------------------------------------------------------------------------
# Health / metadata
# ---------------------------------------------------------------------------
@app.get("/api/health")
def health() -> dict:
    session = get_session()
    verification = ChecksumEngine(session.working, session.profile).verify()
    return {
        "status": "online",
        "engine": "Python + FastAPI + NumPy",
        "supported_ecu": session.profile.display_name,
        "profile_confidence": session.profile.confidence,
        "binary_size": len(session.working),
        "checksum_status": verification["overall_status"],
        "safety_engine": "aktif",
    }


@app.get("/api/ecu/profile")
def ecu_profile() -> dict:
    session = get_session()
    return {
        **session.profile.as_dict(),
        "hardware": {
            "base_hp": session.profile.base_hp,
            "base_torque_nm": session.profile.base_torque_nm,
            "stock_limits": {
                "turbo_pct": 15,
                "injection_pct": 10,
                "throttle_pct": 15,
                "absolute_pct": 20,
                "egt_warning_c": 850,
                "egt_hard_limit_c": 900,
            },
        },
    }


@app.get("/api/ecu/info")
def ecu_info() -> dict:
    session = get_session()
    binary = EcuBinary(session.working, session.profile)
    return {
        "identity": binary.identity().as_dict(),
        "checksum": ChecksumEngine(session.working, session.profile).verify(),
        "original_name": session.original_name,
        "current_params": session.params,
        "maps": [definition.as_dict() for definition in session.profile.maps.values()],
    }


@app.get("/api/maps")
def list_maps() -> dict:
    session = get_session()
    return {
        "profile_id": session.profile.id,
        "maps": [definition.as_dict() for definition in session.profile.maps.values()],
    }


@app.get("/api/map/{map_name}")
def get_map(map_name: str) -> dict:
    session = get_session()
    binary = EcuBinary(session.working, session.profile)
    try:
        return binary.get_map(map_name)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.get("/api/checksum/verify")
def verify_checksum_endpoint() -> dict:
    session = get_session()
    return ChecksumEngine(session.working, session.profile).verify()


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------
@app.post("/api/ecu/upload")
async def upload_binary(file: UploadFile = File(...)) -> dict:
    global SESSION
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Yüklenen dosya boş.")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Dosya çok büyük ({len(content)} bayt). Maksimum 4 MB kabul edilir.",
        )
    profile = detect_profile(content)
    session = _new_session(content, profile, file.filename or "upload.bin")
    # Validate checksum before accepting the file for editing.
    verification = ChecksumEngine(session.working, profile).verify()
    with SESSION_LOCK:
        SESSION = session
    binary = EcuBinary(session.working, profile)
    return {
        "success": True,
        "message": "Dosya doğrulandı ve düzenleme oturumuna yüklendi.",
        "identity": binary.identity().as_dict(),
        "checksum": verification,
        "warning": (
            "Checksum imzası geçersiz. Dosya orijinal olmayabilir; düzenleme "
            "yapılırsa dışa aktarımda yeniden imzalanır, ancak önce orijinal "
            "dump ile karşılaştırın."
            if verification["overall_status"] == "INVALID"
            else None
        ),
    }


# ---------------------------------------------------------------------------
# Validation and tuning
# ---------------------------------------------------------------------------
@app.post("/api/validate")
def validate_tune(payload: TuneInput) -> dict:
    result = GuardrailEngine().evaluate(payload.to_request())
    return result.as_dict()


def _perform_tune(request: TuningRequest) -> dict:
    session = get_session()
    with session.lock:
        guardrail = GuardrailEngine().enforce(request)
        patched, reports = apply_tuning(
            session.base,
            session.profile,
            request.turbo_pct,
            request.injection_pct,
            request.throttle_pct,
        )
        sealed = ChecksumEngine(patched, session.profile).seal()
        verification = ChecksumEngine(sealed, session.profile).verify()
        if verification["overall_status"] != "VALID":
            raise ChecksumError(
                "İmzalama sonrası checksum doğrulanamadı; dosya dışa aktarılmadı.",
                code="CHECKSUM_SELF_TEST_FAILED",
            )
        session.working = bytes(sealed)
        session.params = {
            "turbo": request.turbo_pct,
            "injection": request.injection_pct,
            "throttle": request.throttle_pct,
        }
        label = (
            f"Tune T{request.turbo_pct:+.0f}% / I{request.injection_pct:+.0f}% / "
            f"P{request.throttle_pct:+.0f}%"
        )
        _add_history(session, label, sealed)
        binary = EcuBinary(sealed, session.profile)
        boost_map = binary.get_map("boost")

    return {
        "success": True,
        "message": (
            "Harita değerleri NumPy matris motoruyla güncellendi, mühendislik "
            "sınırları doğrulandı ve checksum yeniden imzalandı."
        ),
        "applied_params": {
            "turbo_offset": request.turbo_pct,
            "injection_offset": request.injection_pct,
            "throttle_offset": request.throttle_pct,
        },
        "guardrail_warnings": guardrail.warnings,
        "guardrail": guardrail.as_dict(),
        "checksum_verification": verification,
        "change_reports": [report.as_dict() for report in reports],
        "updated_matrix": boost_map["matrix"],
        "x_axis": boost_map["x_axis"],
        "y_axis": boost_map["y_axis"],
        "version": session.history[-1]["id"],
    }


@app.post("/api/tune")
def tune_json(payload: TuneInput) -> dict:
    return _perform_tune(payload.to_request())


@app.post("/api/patch")
def patch_maps(
    turbo: float = Form(0.0),
    injection: float = Form(0.0),
    throttle: float = Form(0.0),
    timing_advance_deg: Optional[float] = Form(None),
    rail_pressure_bar: Optional[float] = Form(None),
) -> dict:
    return _perform_tune(
        TuningRequest(
            turbo_pct=turbo,
            injection_pct=injection,
            throttle_pct=throttle,
            timing_advance_deg=timing_advance_deg,
            rail_pressure_bar=rail_pressure_bar,
        )
    )


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------
def _export_bytes(turbo: float, injection: float, throttle: float) -> tuple[bytes, dict]:
    session = get_session()
    request = TuningRequest(turbo_pct=turbo, injection_pct=injection, throttle_pct=throttle)
    guardrail = GuardrailEngine().enforce(request)
    patched, _reports = apply_tuning(
        session.base, session.profile, turbo, injection, throttle
    )
    sealed = ChecksumEngine(patched, session.profile).seal()
    verification = ChecksumEngine(sealed, session.profile).verify()
    if verification["overall_status"] != "VALID":
        raise ChecksumError("Dışa aktarma öncesi checksum doğrulaması başarısız.")
    return bytes(sealed), {
        "guardrail": guardrail.as_dict(),
        "checksum": verification,
    }


@app.get("/api/download")
def download_bin(
    turbo: float = Query(0.0),
    injection: float = Query(0.0),
    throttle: float = Query(0.0),
) -> Response:
    data, meta = _export_bytes(turbo, injection, throttle)
    filename = (
        f"edc15_tuned_T{int(turbo):+d}_I{int(injection):+d}_P{int(throttle):+d}.bin"
    )
    return Response(
        content=data,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(data)),
            "X-Checksum-Status": meta["checksum"]["overall_status"],
            "X-Profile-Id": get_session().profile.id,
        },
    )


# ---------------------------------------------------------------------------
# Version archive (in-memory demo of the Supabase versioning layer)
# ---------------------------------------------------------------------------
@app.get("/api/versions")
def list_versions() -> dict:
    session = get_session()
    return {
        "versions": [
            {key: value for key, value in item.items() if key != "data"}
            for item in session.history
        ],
        "current": session.history[-1]["id"] if session.history else None,
    }


@app.get("/api/versions/{version_id}/download")
def download_version(version_id: str) -> Response:
    session = get_session()
    item = next((entry for entry in session.history if entry["id"] == version_id), None)
    if item is None:
        raise HTTPException(status_code=404, detail="Sürüm bulunamadı.")
    return Response(
        content=bytes(item["data"]),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{version_id}_{session.original_name}"'
        },
    )


@app.post("/api/versions/{version_id}/restore")
def restore_version(version_id: str) -> dict:
    session = get_session()
    item = next((entry for entry in session.history if entry["id"] == version_id), None)
    if item is None:
        raise HTTPException(status_code=404, detail="Sürüm bulunamadı.")
    with session.lock:
        session.base = bytes(item["data"])
        session.working = bytes(item["data"])
    return {
        "success": True,
        "message": f"{version_id} sürümü çalışma dosyasına geri yüklendi.",
        "version": version_id,
    }


# ---------------------------------------------------------------------------
# Presets / marketplace seed data
# ---------------------------------------------------------------------------
PRESETS = [
    {
        "id": "safe-daily",
        "title": "Güvenli Günlük Sürüş",
        "turbo": 4,
        "injection": -4,
        "throttle": 5,
        "risk": "low",
        "description": "Motor ömrünü koruyan dengeli günlük harita.",
    },
    {
        "id": "eco-saver",
        "title": "Ekonomi / Uzun Yol",
        "turbo": 2,
        "injection": -8,
        "throttle": 2,
        "risk": "low",
        "description": "Yakıt tüketimini azaltmaya odaklanır.",
    },
    {
        "id": "sport-stage1",
        "title": "Stage 1 Sport",
        "turbo": 12,
        "injection": 5,
        "throttle": 12,
        "risk": "medium",
        "description": "Stok donanım sınırında performans artışı.",
    },
    {
        "id": "mountain-towing",
        "title": "Yokuş ve Çekiş",
        "turbo": 10,
        "injection": 4,
        "throttle": 8,
        "risk": "medium",
        "description": "Düşük devirde erken tork üretimi.",
    },
]


@app.get("/api/presets")
def presets() -> dict:
    engine = GuardrailEngine()
    output = []
    for preset in PRESETS:
        request = TuningRequest(
            turbo_pct=preset["turbo"],
            injection_pct=preset["injection"],
            throttle_pct=preset["throttle"],
        )
        result = engine.evaluate(request)
        output.append(
            {
                **preset,
                "allowed": result.allowed,
                "risk_level": result.risk_level,
                "estimated_hp_gain": result.estimated_hp_gain,
                "warnings": result.warnings,
            }
        )
    return {"presets": output, "source": "AutoTune AI doğrulanmış preset havuzu"}


# ---------------------------------------------------------------------------
# RAG knowledge base
# ---------------------------------------------------------------------------
DAMOS_KNOWLEDGE_BASE = [
    {
        "keywords": ["yokuş", "yokus", "bayıl", "bayil", "çekiş", "cekis", "tork", "rampa", "güçsüz", "gucsuz"],
        "intent": "hill_climb_torque",
        "description": (
            "Yokuşlarda ve düşük devirlerde erken tork için Tork Limitörü "
            "(0x4F080), Turbo Hedef Basıncı (0x4D200) ve Sürücü İsteği "
            "(0x4C120) haritaları birlikte değerlendirilmelidir."
        ),
        "recommended_params": {"turbo": 12.0, "injection": 6.0, "throttle": 12.0},
        "target_maps": ["0x4F080 (Tork Limitörü)", "0x4D200 (Turbo Hedefi)", "0x4C120 (Sürücü İsteği)"],
        "safety_note": (
            "Düşük devirde ani tork artışı çift kütleli volan (DMF) ve "
            "debriyajı yorar. +%12 güvenli üst sınır kabul edilir."
        ),
    },
    {
        "keywords": ["yakıt", "yakit", "tasarruf", "ekonomi", "uzun yol", "az yaksın", "az yaksin"],
        "intent": "eco_mileage",
        "description": (
            "Duman Limitörü (0x4E150) ve Sürücü İsteği (0x4C120) haritaları "
            "sakin sürüş bölgesinde optimize edilerek yakıt tüketimi düşürülür."
        ),
        "recommended_params": {"turbo": 4.0, "injection": -6.0, "throttle": 4.0},
        "target_maps": ["0x4E150 (Duman Limiti)", "0x4C120 (Sürücü İsteği)"],
        "safety_note": (
            "Aşırı fakir karışım dizelde yanma kararsızlığına yol açar; turbo "
            "basıncı ve EGT birlikte izlenmelidir."
        ),
    },
    {
        "keywords": ["sport", "hız", "hiz", "gaz tepkisi", "atak", "agresif", "stage 1", "stage1"],
        "intent": "stage1_sport",
        "description": (
            "Fabrika turbosu ve enjektör sınırları içinde güvenli Stage 1 "
            "kalibrasyonu: Turbo Hedefi, Sürücü İsteği ve Duman Limiti."
        ),
        "recommended_params": {"turbo": 12.0, "injection": 5.0, "throttle": 12.0},
        "target_maps": ["0x4D200 (Turbo Hedefi)", "0x4C120 (Sürücü İsteği)", "0x4E150 (Duman Limiti)"],
        "safety_note": (
            "Stok GT1749V için +%15 üzeri basınç overboost sayılır; EGT probu "
            "ve dyno doğrulaması olmadan yüklenmemelidir."
        ),
    },
]


@app.post("/api/rag/chat")
def rag_chat(prompt: str = Form(...)) -> dict:
    prompt_lower = prompt.lower()
    matched = next(
        (
            item
            for item in DAMOS_KNOWLEDGE_BASE
            if any(keyword in prompt_lower for keyword in item["keywords"])
        ),
        None,
    )
    matched = matched or DAMOS_KNOWLEDGE_BASE[0]
    request = TuningRequest(
        turbo_pct=matched["recommended_params"]["turbo"],
        injection_pct=matched["recommended_params"]["injection"],
        throttle_pct=matched["recommended_params"]["throttle"],
    )
    guardrail = GuardrailEngine().evaluate(request)
    return {
        "user_query": prompt,
        "matched_intent": matched["intent"],
        "technical_diagnosis": matched["description"],
        "target_ecu_maps": matched["target_maps"],
        "recommended_params": matched["recommended_params"],
        "guardrail_advice": matched["safety_note"],
        "guardrail_check": guardrail.as_dict(),
        "ai_response": (
            f"Talebiniz analiz edildi.\n\n{matched['description']}\n\n"
            f"Hedef harita adresleri: {', '.join(matched['target_maps'])}\n\n"
            f"Güvenlik notu: {matched['safety_note']}"
        ),
        "note": (
            "Bu yanıt yerel Damos/ECU bilgi tabanından üretilmiştir. Üretimde "
            "pgvector/Pinecone tabanlı RAG katmanı aynı sözleşmeyi kullanır."
        ),
    }


# ---------------------------------------------------------------------------
# Datalogger
# ---------------------------------------------------------------------------
@app.post("/api/datalogger/analyze")
async def analyze_datalogger(file: UploadFile = File(...)) -> dict:
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Log dosyası 4 MB sınırını aşıyor.")
    try:
        content = raw.decode("utf-8-sig", errors="ignore")
        return analyze_csv(content, file.filename or "log.csv")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Log analiz hatası: {exc}")


@app.get("/")
def root() -> dict:
    return {
        "name": "AutoTune AI Core Engine",
        "docs": "/docs",
        "health": "/api/health",
        "profile": "/api/ecu/profile",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
