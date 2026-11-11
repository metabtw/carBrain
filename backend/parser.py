"""
Binary parser
=============

Reads Bosch EDC15 style flash images byte-by-byte, extracts 8/16-bit matrix
tables with NumPy and converts raw ADC words to physical units.

Safety rules implemented here
-----------------------------
* Every read is bounds-checked *before* slicing.  A truncated file can never
  produce a silent short read that later gets written back as zeros.
* Endianness is explicit per map (EDC15 uses little-endian "LoHi" words).
* The parser never searches for maps by heuristics in write mode.  It only
  exposes maps that exist in an :mod:`profiles` definition.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import struct
import sys
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import numpy as np

try:  # package import or direct script import
    from .profiles import (
        EDC15_DEMO_PROFILE,
        EcuProfile,
        MapDefinition,
        UnsupportedEcuError,
        detect_profile,
    )
except ImportError:  # pragma: no cover
    from profiles import (
        EDC15_DEMO_PROFILE,
        EcuProfile,
        MapDefinition,
        UnsupportedEcuError,
        detect_profile,
    )


@dataclass(frozen=True)
class EcuIdentity:
    profile_id: str
    display_name: str
    flash_size: int
    sha256: str
    identifier_text: str
    identifier_offset: str
    confidence: str

    def as_dict(self) -> dict:
        return {
            "profile_id": self.profile_id,
            "display_name": self.display_name,
            "flash_size": self.flash_size,
            "flash_size_human": f"{self.flash_size // 1024} KB",
            "sha256": self.sha256,
            "identifier_text": self.identifier_text,
            "identifier_offset": self.identifier_offset,
            "confidence": self.confidence,
        }


class EcuBinary:
    """Immutable helper around one ECU binary image."""

    def __init__(
        self,
        data: bytes | bytearray,
        profile: Optional[EcuProfile] = None,
        *,
        strict: bool = True,
    ) -> None:
        if not data:
            raise ValueError("ECU binary boş olamaz.")
        self.data: bytes = bytes(data)
        self.profile: Optional[EcuProfile] = profile
        if self.profile is None and strict:
            self.profile = detect_profile(self.data)
        if self.profile is not None:
            self.profile.validate_file_size(len(self.data))
            self._validate_profile_bounds(self.profile)

    # ------------------------------------------------------------------ utils
    @staticmethod
    def _validate_profile_bounds(profile: EcuProfile) -> None:
        for definition in profile.maps.values():
            if definition.address < 0 or definition.end_address > profile.flash_size:
                raise UnsupportedEcuError(
                    f"{definition.key} haritası ({hex(definition.address)} - "
                    f"{hex(definition.end_address)}) dosya sınırlarının dışında. "
                    "Profil tanımı bozuk; yazma işlemi engellendi.",
                    reason="MAP_OUT_OF_BOUNDS",
                )
        for region in profile.checksum_regions:
            if region.stored_offset + region.stored_size > profile.flash_size:
                raise UnsupportedEcuError(
                    f"Checksum bölgesi {region.name_tr} dosya dışında.",
                    reason="CHECKSUM_OUT_OF_BOUNDS",
                )

    def _require_profile(self) -> EcuProfile:
        if self.profile is None:
            raise UnsupportedEcuError(
                "Bu işlem için doğrulanmış bir ECU profili gerekiyor.",
                reason="PROFILE_NOT_FOUND",
            )
        return self.profile

    def read_bytes(self, offset: int, length: int) -> bytes:
        if offset < 0 or length < 0:
            raise ValueError("Offset ve uzunluk negatif olamaz.")
        end = offset + length
        if end > len(self.data):
            raise ValueError(
                f"Okuma sınır dışı: {hex(offset)} + {length} bayt = {hex(end)}, "
                f"dosya boyutu {hex(len(self.data))}."
            )
        return self.data[offset:end]

    def get_hex_dump(self, offset: int, length: int = 32) -> str:
        return " ".join(f"{b:02X}" for b in self.read_bytes(offset, length))

    @property
    def size(self) -> int:
        return len(self.data)

    def identity(self) -> EcuIdentity:
        profile = self.profile
        text = ""
        ident_offset = 0
        if profile is not None:
            text = profile.identifier_text(self.data)
            ident_offset = profile.identifier_offset
        return EcuIdentity(
            profile_id=profile.id if profile else "unknown",
            display_name=profile.display_name if profile else "Bilinmeyen ECU",
            flash_size=len(self.data),
            sha256=hashlib.sha256(self.data).hexdigest(),
            identifier_text=text,
            identifier_offset=f"0x{ident_offset:X}",
            confidence=profile.confidence if profile else "unknown",
        )

    # ----------------------------------------------------------------- matrix
    def read_raw_matrix(self, definition: MapDefinition) -> np.ndarray:
        """Return the raw integer matrix without any calibration applied."""
        raw = self.read_bytes(definition.address, definition.byte_length)
        if definition.dtype == "uint16":
            dtype = "<u2" if definition.endian == "little" else ">u2"
            # frombuffer is zero-copy; copy() prevents accidental writes into
            # the immutable source bytes.
            matrix = np.frombuffer(raw, dtype=dtype).reshape(
                definition.rows, definition.cols
            ).copy()
        elif definition.dtype == "uint8":
            matrix = np.frombuffer(raw, dtype=np.uint8).reshape(
                definition.rows, definition.cols
            ).copy()
        else:
            raise ValueError(f"Desteklenmeyen bit derinliği: {definition.dtype}")
        return matrix

    def get_map(self, map_key: str) -> Dict[str, Any]:
        profile = self._require_profile()
        definition = profile.map(map_key)
        raw_matrix = self.read_raw_matrix(definition)
        physical = np.round(
            raw_matrix.astype(np.float64) * definition.factor
            + definition.physical_offset,
            3,
        )

        return {
            "address": f"0x{definition.address:X}",
            "name": definition.name_de,
            "name_tr": definition.name_tr,
            "name_de": definition.name_de,
            "rows": definition.rows,
            "cols": definition.cols,
            "bit_depth": 16 if definition.dtype == "uint16" else 8,
            "endian": "little" if definition.endian == "little" else "big",
            "factor": definition.factor,
            "unit": definition.unit,
            "hex_preview": self.get_hex_dump(
                definition.address, min(32, definition.byte_length)
            ),
            "matrix": physical.tolist(),
            "raw_matrix": raw_matrix.astype(int).tolist(),
            "x_axis": [float(v) for v in definition.x_axis],
            "y_axis": [float(v) for v in definition.y_axis],
            "x_name": definition.x_name_tr,
            "y_name": definition.y_name_tr,
            "x_unit": "",
            "y_unit": "RPM",
            "stats": {
                "min": float(physical.min()),
                "max": float(physical.max()),
                "mean": float(np.round(physical.mean(), 3)),
                "shape": list(physical.shape),
            },
            "definition": definition.as_dict(),
        }

    def get_known_map(self, map_key: str) -> Dict[str, Any]:
        """Backwards-compatible alias used by the Next.js bridge."""
        return self.get_map(map_key)

    # Generic address read (used only for read-only inspection / AI preview)
    def get_matrix(
        self,
        offset: int,
        rows: int = 16,
        cols: int = 16,
        bit_depth: int = 16,
        endian: str = "<",
        factor: float = 1.0,
        offset_val: float = 0.0,
        decimals: int = 1,
    ) -> Dict[str, Any]:
        definition = MapDefinition(
            key="custom",
            name_tr="Serbest Adres Okuması",
            name_de="Custom address",
            address=offset,
            rows=rows,
            cols=cols,
            factor=factor,
            physical_offset=offset_val,
            unit="",
            x_name_tr="X",
            y_name_tr="Y",
            x_axis=tuple(round(c * (100.0 / max(1, cols - 1)), 1) for c in range(cols)),
            y_axis=tuple(round(800 + r * (3700.0 / max(1, rows - 1)), 0) for r in range(rows)),
            dtype="uint16" if bit_depth == 16 else "uint8",
            endian="little" if endian == "<" else "big",
            source="manual address (read-only)",
            confidence="unverified",
        )
        raw_matrix = self.read_raw_matrix(definition)
        physical = np.round(
            raw_matrix.astype(np.float64) * definition.factor
            + definition.physical_offset,
            decimals,
        )
        return {
            "address": f"0x{offset:X}",
            "rows": rows,
            "cols": cols,
            "bit_depth": bit_depth,
            "endian": "little" if endian == "<" else "big",
            "factor": factor,
            "hex_preview": self.get_hex_dump(offset, min(32, definition.byte_length)),
            "matrix": physical.tolist(),
            "raw_matrix": raw_matrix.astype(int).tolist(),
            "x_axis": list(definition.x_axis),
            "y_axis": list(definition.y_axis),
            "name": "Serbest Adres Okuması",
            "unit": "",
            "x_name": "X",
            "y_name": "Y",
            "definition": definition.as_dict(),
        }

    def map_summaries(self) -> List[dict]:
        profile = self._require_profile()
        return [definition.as_dict() for definition in profile.maps.values()]


class EcuBinaryParser:
    """
    Compatibility wrapper for the original project API.

    ``parser.data`` can be replaced with a patched working buffer, which is how
    the Next.js matrix route previews a modified session.
    """

    def __init__(self, filepath: str, profile: Optional[EcuProfile] = None):
        self.filepath = filepath
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"ECU binary bulunamadı: {filepath}")
        with open(filepath, "rb") as handle:
            self._data = handle.read()
        self._profile = profile

    @property
    def data(self) -> bytes:
        return self._data

    @data.setter
    def data(self, value: bytes | bytearray) -> None:
        self._data = bytes(value)

    @property
    def file_size(self) -> int:
        return len(self._data)

    def _binary(self, strict: bool = False) -> EcuBinary:
        return EcuBinary(self._data, profile=self._profile, strict=strict)

    def detect(self) -> EcuProfile:
        if self._profile is None:
            self._profile = detect_profile(self._data)
        return self._profile

    def read_bytes(self, offset: int, length: int) -> bytes:
        return self._binary().read_bytes(offset, length)

    def get_hex_dump(self, offset: int, length: int) -> str:
        return self._binary().get_hex_dump(offset, length)

    def get_matrix(self, *args, **kwargs) -> Dict[str, Any]:
        return self._binary(strict=False).get_matrix(*args, **kwargs)

    def get_known_map(self, map_name: str) -> Dict[str, Any]:
        # The original implementation always required a known EDC15 map.
        if self._profile is None:
            self._profile = detect_profile(self._data)
        return EcuBinary(self._data, profile=self._profile).get_map(map_name)

    def get_map(self, map_name: str) -> Dict[str, Any]:
        return self.get_known_map(map_name)


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(
        description="AutoTune AI - ECU binary parser (read-only, bounds checked)"
    )
    parser.add_argument("--file", default="data/edc15_19tdi_stock.bin")
    parser.add_argument(
        "--map",
        default=None,
        help="Preset map: boost, driver_wish, smoke_limiter, torque_limiter",
    )
    parser.add_argument("--address", default="0x4D200")
    parser.add_argument("--rows", type=int, default=16)
    parser.add_argument("--cols", type=int, default=16)
    parser.add_argument("--factor", type=float, default=0.1)
    parser.add_argument("--info", action="store_true", help="Print ECU identity")
    args = parser.parse_args()

    ecu = EcuBinaryParser(args.file)
    if args.info:
        result = ecu.detect().as_dict()
        result["identity"] = ecu._binary(strict=True).identity().as_dict()
    elif args.map:
        result = ecu.get_known_map(args.map)
    else:
        offset = int(args.address, 16) if args.address.startswith("0x") else int(args.address)
        result = ecu.get_matrix(
            offset=offset, rows=args.rows, cols=args.cols, factor=args.factor
        )
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
