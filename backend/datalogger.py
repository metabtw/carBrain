"""
OBD2 datalogger analysis
========================

Parses a CSV log exported from VCDS, Torque, Car Scanner or a dyno, then looks
for the classic symptoms of an over-aggressive calibration:

* boost spikes / overboost in a specific RPM window,
* turbo lag (actual pressure far below requested),
* rail pressure collapse under load,
* MAF/boost mismatch.

The thresholds are heuristics for feedback, not a replacement for a wideband
lambda and EGT sensor.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import math
import os
import re
import sys
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Tuple


def _to_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    text = str(value).strip().replace(",", ".")
    if not text:
        return None
    match = re.search(r"-?\d+(?:\.\d+)?", text)
    if not match:
        return None
    try:
        number = float(match.group(0))
    except ValueError:
        return None
    return number if math.isfinite(number) else None


def _pick_column(headers: List[str], *keywords: str) -> Optional[int]:
    normalized = [header.strip().lower() for header in headers]
    for keyword in keywords:
        needle = keyword.lower()
        for index, header in enumerate(normalized):
            if needle in header:
                return index
    return None


@dataclass
class LogAnalysis:
    rows: int
    max_boost: float
    min_boost: float
    spikes: int
    lag_points: int
    rpm_min: float
    rpm_max: float
    rail_min: Optional[float]
    feedback: List[str]
    diagnostics: Dict[str, Any]
    sample: List[dict]


def analyze_csv(content: str, file_name: str = "log.csv") -> Dict[str, Any]:
    if not content.strip():
        raise ValueError("CSV dosyası boş.")

    sample = content[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel

    reader = csv.reader(io.StringIO(content), dialect)
    rows = [row for row in reader if any(str(cell).strip() for cell in row)]
    if len(rows) < 2:
        raise ValueError("CSV en az bir başlık ve bir veri satırı içermeli.")

    headers = [str(cell).strip() for cell in rows[0]]
    rpm_idx = _pick_column(headers, "rpm", "devir", "engine speed")
    specified_idx = _pick_column(
        headers, "specified boost", "target boost", "istenen", "hedef", "requested"
    )
    actual_idx = _pick_column(
        headers, "actual boost", "boost pressure", "turbo", "map", "gerçek", "actual"
    )
    rail_idx = _pick_column(headers, "rail", "ray", "fuel pressure")
    maf_idx = _pick_column(headers, "maf", "air mass", "hava")

    # Fallback to the original positional format: rpm,specified,actual
    if rpm_idx is None or actual_idx is None:
        if len(headers) >= 3:
            rpm_idx, specified_idx, actual_idx = 0, 1, 2
        else:
            raise ValueError(
                "RPM ve turbo basıncı sütunları bulunamadı. Beklenen başlıklar: "
                "RPM, Specified Boost, Actual Boost."
            )

    points: List[dict] = []
    spikes = 0
    lag_points = 0
    max_boost = -math.inf
    min_boost = math.inf
    rail_values: List[float] = []

    for row in rows[1:]:
        if rpm_idx >= len(row) or actual_idx >= len(row):
            continue
        rpm = _to_float(row[rpm_idx])
        actual = _to_float(row[actual_idx])
        if rpm is None or actual is None:
            continue
        specified = (
            _to_float(row[specified_idx])
            if specified_idx is not None and specified_idx < len(row)
            else None
        )
        # Normalize common units.  VCDS logs "mbar"; some apps log bar or psi.
        if actual < 5:
            actual *= 1000.0
        if specified is not None and specified < 5:
            specified *= 1000.0
        if actual < 100:  # psi -> mbar
            actual *= 68.9476
        if specified is not None and specified < 100:
            specified *= 68.9476

        if specified is not None:
            error = actual - specified
            if error > 180:
                spikes += 1
            elif error < -250 and rpm > 1800:
                lag_points += 1

        if rail_idx is not None and rail_idx < len(row):
            rail = _to_float(row[rail_idx])
            if rail is not None:
                rail_values.append(rail)

        max_boost = max(max_boost, actual)
        min_boost = min(min_boost, actual)
        points.append(
            {
                "rpm": round(rpm, 0),
                "specified_boost": round(specified, 1) if specified is not None else None,
                "actual_boost": round(actual, 1),
                "maf": (
                    _to_float(row[maf_idx])
                    if maf_idx is not None and maf_idx < len(row)
                    else None
                ),
            }
        )

    if not points:
        raise ValueError("Geçerli sayısal veri satırı okunamadı.")

    feedback: List[str] = []
    if spikes >= max(3, len(points) * 0.02):
        feedback.append(
            "⚠️ Boost spike tespit edildi: gerçek basınç, istenen basıncı kısa süreli "
            "olarak 180 mbar'dan fazla aşıyor. N75 / basınç kontrol haritasının "
            "ilgili devir bandında %3-5 yumuşatılması önerilir."
        )
    elif lag_points > max(5, len(points) * 0.05):
        feedback.append(
            "⚠️ Turbo gecikmesi (lag) tespit edildi: 1.800 devir üzerinde gerçek "
            "basınç istenenin 250 mbar altında kalıyor. VNT geometrisi, vakum "
            "hattı ve hedef basınç haritası düşük devir bölgesi kontrol edilmeli."
        )
    else:
        feedback.append(
            "✅ Basınç takibi başarılı: istenen ve gerçek turbo basıncı makul "
            "tolerans içinde. Mevcut harita bu log için güvenli görünüyor."
        )

    rail_min = min(rail_values) if rail_values else None
    if rail_min is not None and rail_min < 900:
        feedback.append(
            "⚠️ Yakıt rayı basıncı yük altında 900 bar altına düşmüş. Yakıt "
            "filtresi, pompa regülatörü ve tank içi pompa kontrol edilmeli; "
            "basınç düşükken yakıt haritasını artırmayın."
        )

    if max_boost > 2700:
        feedback.append(
            "⚠️ Mutlak basınç 2.700 mbar üzerinde görüldü. Bu seviye stok "
            "GT1749V için overboost sayılır; haritayı derhal geri çekin."
        )

    diagnostics = {
        "boost_overshoot_count": spikes,
        "turbo_lag_points": lag_points,
        "boost_following_rate_pct": round(
            100.0
            * max(0.0, 1.0 - (spikes + lag_points) / max(1, len(points))),
            1,
        ),
        "min_recorded_boost_mbar": None if min_boost is math.inf else round(min_boost, 1),
        "rail_pressure_min_bar": None if rail_min is None else round(rail_min, 1),
        "columns_detected": {
            "rpm": headers[rpm_idx] if rpm_idx is not None else None,
            "specified_boost": headers[specified_idx] if specified_idx is not None else None,
            "actual_boost": headers[actual_idx] if actual_idx is not None else None,
            "rail_pressure": headers[rail_idx] if rail_idx is not None else None,
            "maf": headers[maf_idx] if maf_idx is not None else None,
        },
    }

    return {
        "file_name": file_name,
        "total_rows_analyzed": len(points),
        "rpm_range": {
            "min": round(min(point["rpm"] for point in points), 0),
            "max": round(max(point["rpm"] for point in points), 0),
        },
        "max_recorded_boost_mbar": None if max_boost is math.inf else round(max_boost, 1),
        "boost_spikes_detected": spikes,
        "ai_engineer_feedback": feedback,
        "diagnostics": diagnostics,
        "sample_telemetry": points[:15],
    }


def analyze_file(path: str, file_name: Optional[str] = None) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8-sig", errors="ignore") as handle:
        content = handle.read()
    return analyze_csv(content, file_name or os.path.basename(path))


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="AutoTune AI - OBD2 datalog analyzer")
    parser.add_argument("--file", required=True, help="CSV log path")
    parser.add_argument("--name", default=None, help="Original file name")
    args = parser.parse_args()
    try:
        result = analyze_file(args.file, args.name)
        print(json.dumps(result, indent=2, ensure_ascii=False))
    except Exception as exc:  # CLI contract: always JSON
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
