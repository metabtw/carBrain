"""
Safe matrix modifier
====================

Applies percentage changes to raw calibration matrices and writes them back
without touching a single byte outside the declared map rectangle.

Design notes
------------
* NumPy performs the arithmetic; Python only performs the final byte packing.
* The boost map is anchored at atmospheric pressure (1_000 mbar).  Scaling the
  *absolute* pressure would also increase the "no boost" region and distort the
  low-load driveability.  Only values above the baseline are scaled.
* Every value is clamped to the map's electrical/mechanical raw range.  A
  clamp is reported, never silently ignored, so the UI can tell the user that
  the requested change was not fully applied.
* Hard per-map limits live here as a last line of defence.  The richer
  engineering rules (EGT, torque, rail pressure, timing) live in guardrails.py.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional, Tuple

import numpy as np

try:  # package import or direct script import
    from .profiles import EcuProfile, MapDefinition
except ImportError:  # pragma: no cover
    from profiles import EcuProfile, MapDefinition


class ModificationError(ValueError):
    def __init__(self, message: str, *, code: str = "MODIFICATION_REJECTED"):
        super().__init__(message)
        self.code = code


@dataclass
class MapChangeReport:
    map_key: str
    map_name_tr: str
    address: str
    requested_pct: float
    applied_pct: float
    cells_total: int
    cells_changed: int
    cells_clamped: int
    min_before: float
    max_before: float
    min_after: float
    max_after: float
    baseline: Optional[float]
    notes: List[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "map_key": self.map_key,
            "map_name_tr": self.map_name_tr,
            "address": self.address,
            "requested_pct": self.requested_pct,
            "applied_pct": self.applied_pct,
            "cells_total": self.cells_total,
            "cells_changed": self.cells_changed,
            "cells_clamped": self.cells_clamped,
            "min_before": round(self.min_before, 3),
            "max_before": round(self.max_before, 3),
            "min_after": round(self.min_after, 3),
            "max_after": round(self.max_after, 3),
            "baseline": self.baseline,
            "unit": "",
            "notes": self.notes,
        }


def _validate_pct(definition: MapDefinition, pct: float) -> float:
    try:
        value = float(pct)
    except (TypeError, ValueError):
        raise ModificationError("Yüzde değeri sayısal olmalı.", code="INVALID_PERCENT")
    if not np.isfinite(value):
        raise ModificationError("Yüzde değeri NaN/Inf olamaz.", code="INVALID_PERCENT")
    if abs(value) > definition.max_absolute_pct:
        raise ModificationError(
            f"{definition.name_tr} için istenen {value:+.1f}% değeri, harita "
            f"donanım sınırı olan ±{definition.max_absolute_pct:.1f}% dışında. "
            "İstek reddedildi.",
            code="MAP_HARD_LIMIT",
        )
    return value


def scale_map(
    data: bytes | bytearray,
    profile: EcuProfile,
    map_key: str,
    pct: float,
    *,
    dry_run: bool = False,
) -> Tuple[bytearray, MapChangeReport]:
    """
    Scale one map by ``pct`` percent and return the new binary + a report.

    ``dry_run=True`` calculates everything but leaves the returned buffer equal
    to the input; useful for the UI preview endpoint.
    """
    definition = profile.map(map_key)
    pct = _validate_pct(definition, pct)
    multiplier = 1.0 + (pct / 100.0)

    buffer = bytearray(data)
    if len(buffer) != profile.flash_size:
        raise ModificationError(
            f"Beklenmeyen dosya boyutu ({len(buffer)} bayt). Yazma işlemi "
            "reddedildi.",
            code="SIZE_MISMATCH",
        )

    dtype = "<u2" if definition.dtype == "uint16" and definition.endian == "little" else (
        ">u2" if definition.dtype == "uint16" else "u1"
    )
    raw = np.frombuffer(
        bytes(buffer[definition.address:definition.end_address]), dtype=dtype
    ).reshape(definition.rows, definition.cols).astype(np.float64)

    physical = raw * definition.factor + definition.physical_offset
    min_before = float(physical.min())
    max_before = float(physical.max())

    notes: List[str] = []
    if definition.baseline is not None:
        # Only scale pressure above atmospheric; otherwise part-load vacuum
        # cells would be inflated and the ECU would request boost at idle.
        mask = physical > definition.baseline
        new_physical = physical.copy()
        new_physical[mask] = definition.baseline + (
            physical[mask] - definition.baseline
        ) * multiplier
        notes.append(
            f"Ölçekleme {definition.baseline:.0f} {definition.unit} tabanı üzerindeki "
            f"{int(mask.sum())} hücreye uygulandı; atmosferik altı hücreler korundu."
        )
    else:
        new_physical = physical * multiplier
        notes.append("Tüm harita hücreleri ölçeklendi.")

    new_raw_float = (new_physical - definition.physical_offset) / definition.factor
    new_raw = np.rint(new_raw_float).astype(np.int64)
    clamped = int(
        np.count_nonzero(
            (new_raw < definition.raw_min) | (new_raw > definition.raw_max)
        )
    )
    new_raw = np.clip(new_raw, definition.raw_min, definition.raw_max)
    if clamped:
        notes.append(
            f"{clamped} hücre ham değer sınırına ({definition.raw_min}.."
            f"{definition.raw_max}) çekildi. İstenen değişiklik tam uygulanmadı."
        )

    changed = int(np.count_nonzero(new_raw != raw.astype(np.int64)))
    if changed == 0:
        notes.append("Değişiklik uygulanacak hücre bulunamadı (değer zaten sınırda).")

    new_physical_actual = new_raw.astype(np.float64) * definition.factor + definition.physical_offset
    report = MapChangeReport(
        map_key=definition.key,
        map_name_tr=definition.name_tr,
        address=f"0x{definition.address:X}",
        requested_pct=pct,
        applied_pct=pct if changed or not clamped else 0.0,
        cells_total=int(raw.size),
        cells_changed=changed,
        cells_clamped=clamped,
        min_before=min_before,
        max_before=max_before,
        min_after=float(new_physical_actual.min()),
        max_after=float(new_physical_actual.max()),
        baseline=definition.baseline,
        notes=notes,
    )

    if not dry_run:
        pack_dtype = np.dtype(dtype)
        buffer[definition.address:definition.end_address] = new_raw.astype(
            pack_dtype
        ).tobytes()

    return buffer, report


def apply_tuning(
    data: bytes | bytearray,
    profile: EcuProfile,
    turbo_pct: float = 0.0,
    injection_pct: float = 0.0,
    throttle_pct: float = 0.0,
    torque_pct: float = 0.0,
) -> Tuple[bytearray, List[MapChangeReport]]:
    """
    Apply the user-facing sliders in one deterministic pass.

    Mapping (kept stable for the existing UI):
      turbo    -> boost / Ladedruck Soll
      injection-> smoke limiter (maximum fuel for the available air mass)
      throttle -> driver wish (pedal -> requested IQ)
      torque   -> torque limiter (maximum allowed torque / IQ ceiling)
    """
    buffer = bytearray(data)
    reports: List[MapChangeReport] = []
    for map_key, pct in (
        ("boost", turbo_pct),
        ("smoke_limiter", injection_pct),
        ("driver_wish", throttle_pct),
        ("torque_limiter", torque_pct),
    ):
        if abs(float(pct)) < 1e-9:
            continue
        buffer, report = scale_map(buffer, profile, map_key, pct)
        reports.append(report)
    return buffer, reports


def preview_changes(
    data: bytes,
    profile: EcuProfile,
    turbo_pct: float = 0.0,
    injection_pct: float = 0.0,
    throttle_pct: float = 0.0,
    torque_pct: float = 0.0,
) -> List[dict]:
    """Read-only preview used by the UI before applying a tune."""
    reports = []
    for map_key, pct in (
        ("boost", turbo_pct),
        ("smoke_limiter", injection_pct),
        ("driver_wish", throttle_pct),
        ("torque_limiter", torque_pct),
    ):
        if abs(float(pct)) < 1e-9:
            continue
        _, report = scale_map(data, profile, map_key, pct, dry_run=True)
        reports.append(report.as_dict())
    return reports
