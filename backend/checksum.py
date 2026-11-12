"""
Checksum engine
===============

Why this module exists
----------------------
An ECU validates its flash contents at boot.  If a calibration byte is changed
without updating the corresponding signature, the ECU may refuse to start or may
behave unpredictably.  In the field this is called "bricking".  Therefore every
export goes through :meth:`ChecksumEngine.seal` and is read back and verified
before it is streamed to the user.

Algorithm scope
---------------
The bundled demo profile uses a 32-bit little-endian additive checksum over
16-bit words (the common "sum of words" scheme found in older Bosch
calibrations).  It is implemented as a *pluggable* registry because real
EDC15/ME7 variants use different regions and sometimes different polynomials.

A region is only considered valid when the stored bytes exactly equal the
recalculated value.  The previous implementation always returned "VALID",
which gave a false sense of safety; this one does not.
"""

from __future__ import annotations

import struct
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

try:  # allow both `backend.checksum` and `python backend/main.py`
    from .profiles import ChecksumRegion, EcuProfile, UnsupportedEcuError
except ImportError:  # pragma: no cover - direct script execution path
    from profiles import ChecksumRegion, EcuProfile, UnsupportedEcuError


class ChecksumError(RuntimeError):
    """Raised when a checksum cannot be calculated or verified."""

    def __init__(self, message: str, *, code: str = "CHECKSUM_INVALID"):
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class RegionResult:
    name_tr: str
    start: int
    end: int
    stored_offset: int
    stored_hex: str
    calculated_hex: str
    status: str  # VALID | INVALID | UNSEALED
    algorithm: str
    detail: str

    def as_dict(self) -> dict:
        return {
            "name": self.name_tr,
            "range": f"0x{self.start:X} - 0x{self.end:X}",
            "stored_offset": f"0x{self.stored_offset:X}",
            "stored_hex": self.stored_hex,
            "calculated_hex": self.calculated_hex,
            "status": self.status,
            "algorithm": self.algorithm,
            "detail": self.detail,
        }


def sum16_words_le(data: bytes, start: int, end: int) -> int:
    """
    Additive checksum over 16-bit little-endian words in ``[start, end)``.

    A trailing odd byte is added as an 8-bit value.  The accumulator is masked
    to 32 bits because the EDC15 calibration signature is stored as a 32-bit
    value even though the operands are 16-bit words.
    """
    if start < 0 or end < start or end > len(data):
        raise ChecksumError(
            f"Checksum aralığı geçersiz: {hex(start)} - {hex(end)} "
            f"(dosya {len(data)} bayt)."
        )
    total = 0
    index = start
    while index + 1 < end:
        total = (total + int.from_bytes(data[index:index + 2], "little")) & 0xFFFFFFFF
        index += 2
    if index < end:
        total = (total + data[index]) & 0xFFFFFFFF
    return total


ALGORITHMS = {
    "sum16_words_le_u32": sum16_words_le,
}


class ChecksumEngine:
    def __init__(self, data: bytes | bytearray, profile: EcuProfile):
        self.data = bytearray(data)
        self.profile = profile

    def _require_regions(self) -> None:
        if not self.profile.checksum_regions:
            raise ChecksumError(
                f"{self.profile.display_name} için checksum bölgesi tanımlı değil. "
                "Bu profil salt okunur; dosya imzalanamaz ve dışa aktarılamaz.",
                code="CHECKSUM_REGION_MISSING",
            )

    # ------------------------------------------------------------------ verify
    def verify_region(self, region: ChecksumRegion) -> RegionResult:
        algorithm = ALGORITHMS.get(region.algorithm)
        if algorithm is None:
            raise ChecksumError(
                f"Bilinmeyen checksum algoritması: {region.algorithm}",
                code="CHECKSUM_ALGORITHM_UNKNOWN",
            )
        calculated = algorithm(bytes(self.data), region.start, region.end)
        stored_bytes = self.data[
            region.stored_offset:region.stored_offset + region.stored_size
        ]
        if len(stored_bytes) != region.stored_size:
            raise ChecksumError(
                f"{region.name_tr}: saklanan checksum okunamadı "
                f"({hex(region.stored_offset)}).",
                code="CHECKSUM_TRUNCATED",
            )
        stored = int.from_bytes(stored_bytes, "little")
        blank = all(byte == 0xFF for byte in stored_bytes)
        if blank:
            status = "UNSEALED"
            detail = (
                "Bu bölge henüz imzalanmamış (0xFF). Orijinal stok dump veya "
                "checksum alanı temizlenmiş bir dosya olabilir. İlk dışa "
                "aktarmada otomatik imzalanacak."
            )
        elif stored == calculated:
            status = "VALID"
            detail = "Saklanan imza yeniden hesaplanan değerle birebir eşleşiyor."
        else:
            status = "INVALID"
            detail = (
                "Saklanan imza ile hesaplanan değer farklı. Dosya değiştirilmiş "
                "veya checksum alanı bozulmuş; bu haliyle ECU'ya yazılmamalı."
            )
        return RegionResult(
            name_tr=region.name_tr,
            start=region.start,
            end=region.end,
            stored_offset=region.stored_offset,
            stored_hex=f"0x{stored:08X}",
            calculated_hex=f"0x{calculated:08X}",
            status=status,
            algorithm=region.algorithm,
            detail=detail,
        )

    def verify(self) -> Dict[str, Any]:
        if not self.profile.checksum_regions:
            # Read-only profile: we cannot verify or seal anything.  Report this
            # explicitly instead of pretending the file is valid.
            return {
                "overall_status": "NOT_APPLICABLE",
                "is_valid": False,
                "can_export": False,
                "profile_id": self.profile.id,
                "confidence": self.profile.confidence,
                "algorithm": None,
                "blocks": [],
                "detail": (
                    "Bu ECU yazılım sürümü için checksum algoritması ve bölgeleri "
                    "tanımlı değil. Dosya salt okunur olarak incelenebilir; "
                    "imzalanamaz ve dışa aktarılamaz."
                ),
            }
        regions = [self.verify_region(region) for region in self.profile.checksum_regions]
        statuses = {result.status for result in regions}
        if "INVALID" in statuses:
            overall = "INVALID"
        elif "UNSEALED" in statuses:
            overall = "UNSEALED"
        else:
            overall = "VALID"
        return {
            "overall_status": overall,
            "is_valid": overall == "VALID",
            "can_export": overall in {"VALID", "UNSEALED"},  # UNSEALED is sealed on export
            "profile_id": self.profile.id,
            "confidence": self.profile.confidence,
            "algorithm": ", ".join(sorted({result.algorithm for result in regions})),
            "blocks": [result.as_dict() for result in regions],
        }

    # -------------------------------------------------------------------- seal
    def seal(self) -> bytearray:
        """Recalculate and write every region signature, then verify."""
        self._require_regions()
        sealed = bytearray(self.data)
        for region in self.profile.checksum_regions:
            algorithm = ALGORITHMS.get(region.algorithm)
            if algorithm is None:
                raise ChecksumError(
                    f"Bilinmeyen checksum algoritması: {region.algorithm}",
                    code="CHECKSUM_ALGORITHM_UNKNOWN",
                )
            value = algorithm(bytes(sealed), region.start, region.end)
            sealed[region.stored_offset:region.stored_offset + region.stored_size] = (
                value.to_bytes(region.stored_size, "little")
            )
        self.data = sealed
        verification = self.verify()
        if verification["overall_status"] != "VALID":
            raise ChecksumError(
                "Checksum imzalama sonrası doğrulama başarısız. Dosya dışa "
                "aktarılmadı.",
                code="CHECKSUM_SELF_TEST_FAILED",
            )
        return sealed


def verify_checksum(data: bytes, profile: EcuProfile) -> Dict[str, Any]:
    return ChecksumEngine(data, profile).verify()


def seal_checksum(data: bytes, profile: EcuProfile) -> bytearray:
    return ChecksumEngine(data, profile).seal()
