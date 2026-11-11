from __future__ import annotations

import pytest

from backend.guardrails import GuardrailEngine, SafetyViolation, TuningRequest


def test_safe_stage1_is_allowed_with_warning():
    result = GuardrailEngine().evaluate(
        TuningRequest(turbo_pct=12.0, injection_pct=5.0, throttle_pct=12.0)
    )
    assert result.allowed is True
    assert result.risk_level in {"high", "medium"}
    assert result.estimated_hp_gain > 0
    assert result.estimated_torque_gain_pct < 20


def test_absolute_limit_20_rejects_without_hardware():
    with pytest.raises(SafetyViolation) as excinfo:
        GuardrailEngine().enforce(
            TuningRequest(turbo_pct=21.0, injection_pct=0.0, throttle_pct=0.0)
        )
    violation = excinfo.value
    assert violation.code == "MECHANICAL_LIMIT"
    assert violation.limit == 20.0
    assert "reddedildi" in str(violation)


def test_full_hardware_allows_extended_envelope():
    result = GuardrailEngine().evaluate(
        TuningRequest(
            turbo_pct=22.0,
            injection_pct=8.0,
            throttle_pct=10.0,
            hardware_upgrades=[
                "upgraded_turbo",
                "upgraded_injectors",
                "dyno_verified",
            ],
        )
    )
    assert result.allowed is True


def test_fuel_without_air_is_rejected():
    with pytest.raises(SafetyViolation) as excinfo:
        GuardrailEngine().enforce(
            TuningRequest(turbo_pct=0.0, injection_pct=10.0, throttle_pct=0.0)
        )
    assert excinfo.value.code in {"AFR_ENVELOPE", "TORQUE_ENVELOPE", "EGT_HARD_LIMIT"}


def test_high_fuel_low_boost_explanation_mentions_egt():
    result = GuardrailEngine().evaluate(
        TuningRequest(turbo_pct=0.0, injection_pct=9.0, throttle_pct=0.0)
    )
    afr = [d for d in result.decisions if d.code == "AFR_ENVELOPE"]
    assert afr
    assert "EGT" in afr[0].engineering_note or "lambda" in afr[0].engineering_note


def test_timing_advance_above_8_deg_rejects_with_detonation_message():
    with pytest.raises(SafetyViolation) as excinfo:
        GuardrailEngine().enforce(
            TuningRequest(turbo_pct=5.0, injection_pct=2.0, timing_advance_deg=10.0)
        )
    assert excinfo.value.code == "DETONATION_RISK"
    assert "vuruntu" in excinfo.value.explanation.lower()
    assert "maksimum %8" in excinfo.value.explanation.lower()


def test_timing_between_5_and_8_is_warning_not_error():
    result = GuardrailEngine().evaluate(
        TuningRequest(turbo_pct=5.0, injection_pct=2.0, timing_advance_deg=6.0)
    )
    assert result.allowed is True
    assert any(decision.code == "TIMING_WARNING" for decision in result.decisions)


def test_egt_hard_limit_rejects_even_with_extended_hardware():
    result = GuardrailEngine().evaluate(
        TuningRequest(
            turbo_pct=25.0,
            injection_pct=25.0,
            throttle_pct=20.0,
            hardware_upgrades=[
                "upgraded_turbo",
                "upgraded_injectors",
                "dyno_verified",
            ],
        )
    )
    assert result.allowed is False
    assert "EGT_HARD_LIMIT" in {d.code for d in result.decisions}


def test_invalid_nan_is_rejected():
    with pytest.raises(SafetyViolation):
        GuardrailEngine().enforce(TuningRequest(turbo_pct=float("nan")))


def test_negative_eco_injection_is_allowed():
    result = GuardrailEngine().evaluate(
        TuningRequest(turbo_pct=2.0, injection_pct=-6.0, throttle_pct=2.0)
    )
    assert result.allowed is True
    assert result.risk_level in {"low", "medium"}
