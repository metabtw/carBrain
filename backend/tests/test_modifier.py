from __future__ import annotations

import numpy as np
import pytest

from backend.modifier import ModificationError, apply_tuning, preview_changes, scale_map
from backend.parser import EcuBinary
from backend.profiles import EDC15_DEMO_PROFILE


def _physical(data: bytes, map_key: str) -> np.ndarray:
    return np.array(EcuBinary(data, EDC15_DEMO_PROFILE).get_map(map_key)["matrix"])


def test_boost_scaling_is_anchored_to_atmospheric_pressure(demo_bin):
    before = _physical(demo_bin, "boost")
    patched, report = scale_map(demo_bin, EDC15_DEMO_PROFILE, "boost", 10.0)
    after = _physical(bytes(patched), "boost")

    mask = before > 1000.0
    assert mask.any()
    # Cells at/below 1000 mbar (atmospheric) must not move.
    assert np.allclose(after[~mask], before[~mask])
    # Cells above baseline scale only the boost part.
    expected = 1000.0 + (before[mask] - 1000.0) * 1.10
    assert np.allclose(after[mask], expected, atol=0.06)
    assert report.cells_changed > 0
    assert report.baseline == 1000.0


def test_negative_boost_reduces_only_above_baseline(demo_bin):
    before = _physical(demo_bin, "boost")
    patched, _ = scale_map(demo_bin, EDC15_DEMO_PROFILE, "boost", -10.0)
    after = _physical(bytes(patched), "boost")
    mask = before > 1000.0
    expected = 1000.0 + (before[mask] - 1000.0) * 0.90
    assert np.allclose(after[mask], expected, atol=0.06)
    assert after.min() >= before.min()


def test_bytes_outside_map_are_untouched(demo_bin):
    definition = EDC15_DEMO_PROFILE.map("boost")
    patched, _ = scale_map(demo_bin, EDC15_DEMO_PROFILE, "boost", 12.0)
    assert patched[:definition.address] == bytearray(demo_bin[:definition.address])
    assert patched[definition.end_address:] == bytearray(demo_bin[definition.end_address:])


def test_injection_scales_smoke_limiter(demo_bin):
    before = _physical(demo_bin, "smoke_limiter")
    patched, report = scale_map(demo_bin, EDC15_DEMO_PROFILE, "smoke_limiter", 5.0)
    after = _physical(bytes(patched), "smoke_limiter")
    assert np.allclose(after, before * 1.05, atol=0.02)
    assert report.map_key == "smoke_limiter"


def test_hard_map_limit_is_rejected(demo_bin):
    with pytest.raises(ModificationError) as excinfo:
        scale_map(demo_bin, EDC15_DEMO_PROFILE, "boost", 25.0)
    assert excinfo.value.code == "MAP_HARD_LIMIT"


def test_dry_run_does_not_change_bytes(demo_bin):
    patched, _ = scale_map(demo_bin, EDC15_DEMO_PROFILE, "boost", 10.0, dry_run=True)
    assert bytes(patched) == demo_bin


def test_combined_tune_is_deterministic(demo_bin):
    first, reports = apply_tuning(demo_bin, EDC15_DEMO_PROFILE, 12.0, 5.0, 10.0)
    second, _ = apply_tuning(demo_bin, EDC15_DEMO_PROFILE, 12.0, 5.0, 10.0)
    assert bytes(first) == bytes(second)
    assert {report.map_key for report in reports} == {
        "boost",
        "smoke_limiter",
        "driver_wish",
    }


def test_zero_tune_is_noop(demo_bin):
    patched, reports = apply_tuning(demo_bin, EDC15_DEMO_PROFILE, 0, 0, 0)
    assert bytes(patched) == demo_bin
    assert reports == []


def test_preview_reports_without_writing(demo_bin):
    preview = preview_changes(demo_bin, EDC15_DEMO_PROFILE, 10.0, 0, 0)
    assert preview[0]["cells_changed"] > 0
    assert bytes(demo_bin) == bytes(demo_bin)


def test_non_finite_percent_is_rejected(demo_bin):
    with pytest.raises(ModificationError):
        scale_map(demo_bin, EDC15_DEMO_PROFILE, "boost", float("nan"))
