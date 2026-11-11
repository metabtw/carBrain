from __future__ import annotations

import numpy as np
import pytest

from backend.parser import EcuBinary, EcuBinaryParser
from backend.profiles import EDC15_DEMO_PROFILE, UnsupportedEcuError, detect_profile


def test_profile_detection_uses_identifier_and_size(demo_bin):
    profile = detect_profile(demo_bin)
    assert profile.id == EDC15_DEMO_PROFILE.id
    assert profile.identifier_text(demo_bin).startswith("038906019HJ")


def test_unknown_512kb_file_is_rejected(demo_bin):
    broken = bytearray(demo_bin)
    broken[EDC15_DEMO_PROFILE.identifier_offset:EDC15_DEMO_PROFILE.identifier_offset + 64] = (
        b"\x00" * 64
    )
    with pytest.raises(UnsupportedEcuError):
        detect_profile(bytes(broken))


def test_wrong_size_is_rejected(demo_bin):
    with pytest.raises(UnsupportedEcuError):
        detect_profile(demo_bin[:1000])


def test_read_bounds_are_enforced(demo_bin):
    binary = EcuBinary(demo_bin, EDC15_DEMO_PROFILE)
    with pytest.raises(ValueError):
        binary.read_bytes(len(demo_bin) - 4, 8)


def test_boost_matrix_shape_and_calibration(demo_bin):
    binary = EcuBinary(demo_bin, EDC15_DEMO_PROFILE)
    result = binary.get_map("boost")
    matrix = np.array(result["matrix"])
    assert matrix.shape == (16, 16)
    assert result["address"] == "0x4D200"
    assert result["unit"] == "mbar"
    # Demo generator: 1000 mbar atmospheric baseline + up to 1150 mbar boost.
    assert matrix.min() >= 1000.0
    assert matrix.max() <= 2150.0
    assert result["raw_matrix"][0][0] == pytest.approx(10000, abs=1)
    assert result["x_axis"][0] == 10.0
    assert result["y_axis"][0] == 1200


def test_little_endian_raw_read(demo_bin):
    binary = EcuBinary(demo_bin, EDC15_DEMO_PROFILE)
    raw = binary.read_raw_matrix(EDC15_DEMO_PROFILE.map("boost"))
    # 10000 decimal = 0x2710 -> little endian bytes 10 27 at the map start.
    offset = EDC15_DEMO_PROFILE.map("boost").address
    assert demo_bin[offset:offset + 2] == b"\x10\x27"
    assert int(raw[0][0]) == 10000


def test_legacy_parser_can_swap_working_buffer(demo_bin, tmp_path):
    path = tmp_path / "stock.bin"
    path.write_bytes(demo_bin)
    parser = EcuBinaryParser(str(path))
    original = parser.get_known_map("boost")
    patched = bytearray(demo_bin)
    patched[EDC15_DEMO_PROFILE.map("boost").address:EDC15_DEMO_PROFILE.map("boost").address + 2] = (
        b"\x20\x4E"  # 20000 -> 2000 mbar
    )
    parser.data = patched
    updated = parser.get_known_map("boost")
    assert updated["matrix"][0][0] > original["matrix"][0][0]


def test_generic_address_read_is_read_only(demo_bin):
    binary = EcuBinary(demo_bin, EDC15_DEMO_PROFILE)
    result = binary.get_matrix(0x4D200, rows=2, cols=2, factor=0.1)
    assert np.array(result["matrix"]).shape == (2, 2)
    assert result["definition"]["confidence"] == "unverified"
