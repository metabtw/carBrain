"""
Deneysel (ham) düzenleme modu
=============================

Doğrulanmış harita tanımı (XDF/DAMOS) olmayan dosyalar için, profile
``tuning_enabled=False`` kalırken kullanıcının BİLEREK ve ONAYLAYARAK bayt
yazabildiği ayrı bir yol.  Normal ``cli_tune`` hattına dokunmaz.

Kurallar
--------
* Sınır dışı yazma reddedilir; tek seferde en fazla ``MAX_PATCH_BYTES`` bayt.
* Orijinal dosya her zaman ``<çıktı>.original.bin`` olarak yedeklenir.
* Değişen her bölge diff raporuna yazılır (offset, önce, sonra).
* Checksum ASLA "VALID" diye raporlanmaz.  Durum her zaman ``UNVERIFIED``.
* Dosya boşluk oranı raporlanır: çoğu 0xFF ise dump eksik/kısmi olabilir.
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List

MAX_PATCH_BYTES = 64 * 1024
BLOCK = 0x10000


class RawEditError(ValueError):
    def __init__(self, message: str, *, code: str = "RAW_EDIT_REJECTED"):
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class RawPatch:
    offset: int
    data: bytes


def parse_patches(items: Iterable[Dict[str, Any]]) -> List[RawPatch]:
    """[{"offset": "0x1C1234", "hex": "01 02 FF"}, ...] -> RawPatch listesi."""
    patches: List[RawPatch] = []
    for item in items:
        try:
            offset = int(str(item["offset"]), 0)
            payload = bytes.fromhex(str(item["hex"]).replace(" ", ""))
        except (KeyError, ValueError) as exc:
            raise RawEditError(f"Geçersiz yama kaydı: {item!r}", code="BAD_PATCH") from exc
        if not payload:
            raise RawEditError("Boş yama.", code="BAD_PATCH")
        patches.append(RawPatch(offset, payload))
    return patches


def apply_raw_patches(data: bytes, patches: List[RawPatch]) -> bytearray:
    buf = bytearray(data)
    total = sum(len(p.data) for p in patches)
    if total > MAX_PATCH_BYTES:
        raise RawEditError(
            f"Toplam {total} bayt; tek seferde en fazla {MAX_PATCH_BYTES} bayt.",
            code="PATCH_TOO_LARGE",
        )
    for p in patches:
        if p.offset < 0 or p.offset + len(p.data) > len(buf):
            raise RawEditError(
                f"Sınır dışı yazma: 0x{p.offset:X} + {len(p.data)} bayt "
                f"(dosya 0x{len(buf):X}).",
                code="OUT_OF_BOUNDS",
            )
    for p in patches:
        buf[p.offset:p.offset + len(p.data)] = p.data
    return buf


def diff_regions(original: bytes, modified: bytes, merge_gap: int = 8) -> List[dict]:
    """Değişen bölgeleri birleştirerek listeler."""
    regions: List[list] = []
    for i, (a, b) in enumerate(zip(original, modified)):
        if a == b:
            continue
        if regions and i - regions[-1][1] <= merge_gap:
            regions[-1][1] = i + 1
        else:
            regions.append([i, i + 1])
    return [
        {
            "offset": f"0x{s:X}",
            "length": e - s,
            "before": original[s:e][:32].hex(" ").upper(),
            "after": modified[s:e][:32].hex(" ").upper(),
        }
        for s, e in regions
    ]


def data_layout(data: bytes) -> dict:
    """64 KB bloklarda dolu/boş (0xFF) dağılımı; kısmi dump tespiti için."""
    blocks = []
    for i in range(0, len(data), BLOCK):
        blk = data[i:i + BLOCK]
        filled = 1.0 - blk.count(0xFF) / len(blk)
        blocks.append({"offset": f"0x{i:X}", "filled_pct": round(filled * 100, 1)})
    populated = [b for b in blocks if b["filled_pct"] > 1.0]
    blank_ratio = data.count(0xFF) / len(data)
    return {
        "blank_ratio_pct": round(blank_ratio * 100, 1),
        "populated_blocks": populated,
        "looks_partial": blank_ratio > 0.5,
    }


def export_experimental(
    input_path: str, output_path: str, patches: List[RawPatch]
) -> Dict[str, Any]:
    with open(input_path, "rb") as handle:
        original = handle.read()
    modified = apply_raw_patches(original, patches)

    base, _ = os.path.splitext(output_path)
    backup_path = f"{base}.original.bin"
    report_path = f"{base}.diff.json"
    shutil.copyfile(input_path, backup_path)
    with open(output_path, "wb") as handle:
        handle.write(modified)

    layout = data_layout(original)
    warnings = [
        "Checksum doğrulanmadı/güncellenmedi (UNVERIFIED). Bu dosya doğrudan "
        "ECU'ya yazılmamalı; önce doğru checksum algoritmasıyla düzeltilmeli.",
    ]
    if layout["looks_partial"]:
        warnings.append(
            f"Dosyanın %{layout['blank_ratio_pct']}'i 0xFF. Bu tam bir flash "
            "okuması değil, kalibrasyon/kısmi dump olabilir; tam görüntü gibi "
            "yazılırsa ECU çalışmayabilir."
        )
    report = {
        "success": True,
        "mode": "experimental",
        "checksum_status": "UNVERIFIED",
        "input_sha256": hashlib.sha256(original).hexdigest(),
        "output_sha256": hashlib.sha256(modified).hexdigest(),
        "bytes_changed": sum(1 for a, b in zip(original, modified) if a != b),
        "regions": diff_regions(original, modified),
        "backup": backup_path,
        "layout": layout,
        "warnings": warnings,
    }
    with open(report_path, "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2, ensure_ascii=False)
    report["report"] = report_path
    return report
