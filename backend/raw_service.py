"""
Ham (deneysel) düzenleme servisi
================================

``raw_edit`` modülünün üzerine ince bir HTTP/CLI katmanı.  Aynı iş mantığı hem
FastAPI uçları hem de Next.js köprüsünün çağırdığı CLI tarafından kullanılır,
böylece iki yol birbirinden ayrışmaz.

Tasarım kuralları
-----------------
* Checksum durumu bu modülde ASLA ``VALID`` olmaz; her rapor ``UNVERIFIED``
  taşır.  Doğrulanmış yol (``checksum.ChecksumEngine``) ayrı kalır.
* Önizleme hiçbir dosyaya yazmaz; yalnızca bellekte uygular ve diff üretir.
* Hex okuma sınır kontrollüdür ve tek istekte ``MAX_HEX_BYTES`` ile sınırlıdır.
"""

from __future__ import annotations

from typing import Any, Dict, Iterable, List

try:  # paket veya doğrudan script çalıştırma
    from .raw_edit import (
        BLOCK,
        RawEditError,
        apply_raw_patches,
        data_layout,
        diff_regions,
        parse_patches,
    )
except ImportError:  # pragma: no cover
    from raw_edit import (
        BLOCK,
        RawEditError,
        apply_raw_patches,
        data_layout,
        diff_regions,
        parse_patches,
    )

MAX_HEX_BYTES = 4 * 1024
BYTES_PER_ROW = 16


def session_mode(tuning_enabled: bool) -> str:
    """Profil yazılabilirliğine göre oturum modu."""
    return "verified" if tuning_enabled else "experimental_available"


def _blank_blocks(layout: Dict[str, Any]) -> List[Dict[str, Any]]:
    populated = {block["offset"] for block in layout["populated_blocks"]}
    return [block for block in layout["blocks"] if block["offset"] not in populated]


def layout_report(data: bytes) -> Dict[str, Any]:
    """64 KB blok dağılımı + kısmi dump yorumu."""
    layout = data_layout(data)
    layout["success"] = True
    layout["block_size"] = BLOCK
    # ``data_layout`` yalnızca dolu blokları döndürür; hex editörde boş blokları
    # da vurgulayabilmek için tam listeyi burada üretiyoruz.
    layout["blocks"] = [
        {
            "offset": f"0x{start:X}",
            "filled_pct": round(
                (1.0 - data[start:start + BLOCK].count(0xFF) / len(data[start:start + BLOCK]))
                * 100,
                1,
            ),
        }
        for start in range(0, len(data), BLOCK)
    ]
    layout["file_size"] = len(data)
    layout["notes_tr"] = (
        [
            "Dosyanın büyük bölümü 0xFF. Bu tam bir flash okuması değil, "
            "kalibrasyon (kısmi) dump olabilir; tam görüntü gibi yazılırsa ECU "
            "çalışmayabilir."
        ]
        if layout["looks_partial"]
        else ["Dosya dolu görünüyor; yine de checksum doğrulanmadan yazılmamalı."]
    )
    return layout


def read_hex(data: bytes, offset: int, length: int) -> Dict[str, Any]:
    """Sınır kontrollü hex okuma (en fazla ``MAX_HEX_BYTES``)."""
    if offset < 0:
        raise RawEditError("Offset negatif olamaz.", code="OUT_OF_BOUNDS")
    if length <= 0:
        raise RawEditError("Uzunluk pozitif olmalı.", code="BAD_LENGTH")
    if length > MAX_HEX_BYTES:
        raise RawEditError(
            f"Tek istekte en fazla {MAX_HEX_BYTES} bayt okunabilir ({length} istendi).",
            code="LENGTH_TOO_LARGE",
        )
    end = offset + length
    if end > len(data):
        raise RawEditError(
            f"Sınır dışı okuma: 0x{offset:X} + {length} bayt (dosya 0x{len(data):X}).",
            code="OUT_OF_BOUNDS",
        )
    chunk = data[offset:end]
    rows = []
    for index in range(0, len(chunk), BYTES_PER_ROW):
        line = chunk[index:index + BYTES_PER_ROW]
        rows.append(
            {
                "offset": f"0x{offset + index:06X}",
                "hex": line.hex(" ").upper(),
                "ascii": "".join(
                    chr(byte) if 32 <= byte < 127 else "." for byte in line
                ),
            }
        )
    return {
        "success": True,
        "offset": f"0x{offset:X}",
        "length": len(chunk),
        "file_size": len(data),
        "bytes_per_row": BYTES_PER_ROW,
        "rows": rows,
        "hex": chunk.hex(" ").upper(),
    }


def preview_patches(
    data: bytes, patch_items: Iterable[Dict[str, Any]]
) -> Dict[str, Any]:
    """Yamaları bellekte uygular; dosyaya dokunmaz."""
    patches = parse_patches(patch_items)
    modified = apply_raw_patches(data, patches)
    layout = layout_report(data)
    regions = diff_regions(data, bytes(modified))

    warnings = [
        "Checksum doğrulanmadı ve güncellenmedi (UNVERIFIED). Bu dosya doğrudan "
        "ECU'ya yazılmamalı; önce doğru checksum algoritmasıyla düzeltilmeli.",
    ]
    if layout["looks_partial"]:
        warnings.append(
            f"Dosyanın %{layout['blank_ratio_pct']}'i 0xFF. Kısmi/kalibrasyon "
            "dump olabilir; tam görüntü gibi yazılırsa ECU çalışmayabilir."
        )
    blank = {block["offset"] for block in _blank_blocks(layout)}
    for patch in patches:
        block_key = f"0x{(patch.offset // BLOCK) * BLOCK:X}"
        if block_key in blank:
            warnings.append(
                f"0x{patch.offset:X} boş (0xFF) bir blokta ({block_key}). Bu adres "
                "gerçek kalibrasyon verisi içermiyor olabilir."
            )

    return {
        "success": True,
        "mode": "experimental",
        "checksum_status": "UNVERIFIED",
        "patch_count": len(patches),
        "bytes_patched": sum(len(patch.data) for patch in patches),
        "bytes_changed": sum(
            1 for before, after in zip(data, modified) if before != after
        ),
        "regions": regions,
        "warnings": warnings,
        "layout": layout,
    }
