from __future__ import annotations

from backend.datalogger import analyze_csv


CSV_HEADER = "RPM,Specified Boost (mbar),Actual Boost (mbar),Rail Pressure (bar)\n"


def test_clean_log_passes():
    rows = [CSV_HEADER]
    for rpm in range(1500, 4000, 100):
        rows.append(f"{rpm},1800,1780,1350\n")
    result = analyze_csv("".join(rows), "clean.csv")
    assert result["total_rows_analyzed"] > 0
    assert result["boost_spikes_detected"] == 0
    assert any("başarılı" in note for note in result["ai_engineer_feedback"])


def test_boost_spikes_are_detected():
    rows = [CSV_HEADER]
    for rpm in range(2400, 4000, 100):
        rows.append(f"{rpm},1800,2100,1350\n")
    result = analyze_csv("".join(rows), "spike.csv")
    assert result["boost_spikes_detected"] > 3
    assert any("spike" in note.lower() for note in result["ai_engineer_feedback"])


def test_turbo_lag_is_detected():
    rows = [CSV_HEADER]
    for rpm in range(1900, 4000, 100):
        rows.append(f"{rpm},2000,1500,1350\n")
    result = analyze_csv("".join(rows), "lag.csv")
    assert result["diagnostics"]["turbo_lag_points"] > 0
    assert any("lag" in note.lower() for note in result["ai_engineer_feedback"])


def test_low_rail_pressure_is_flagged():
    rows = [CSV_HEADER]
    for rpm in range(2000, 4000, 100):
        rows.append(f"{rpm},1800,1780,800\n")
    result = analyze_csv("".join(rows), "rail.csv")
    assert result["diagnostics"]["rail_pressure_min_bar"] == 800
    assert any("rayı" in note.lower() or "ray" in note.lower() for note in result["ai_engineer_feedback"])


def test_positional_csv_fallback():
    content = "rpm,target,actual\n2000,1800,1780\n2500,1900,1880\n"
    result = analyze_csv(content, "legacy.csv")
    assert result["total_rows_analyzed"] == 2


def test_empty_csv_raises():
    try:
        analyze_csv("", "empty.csv")
    except ValueError as exc:
        assert "boş" in str(exc).lower()
    else:  # pragma: no cover
        raise AssertionError("ValueError bekleniyordu")
