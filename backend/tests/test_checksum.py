from __future__ import annotations

import pytest

from backend.checksum import ChecksumEngine, ChecksumError, sum16_words_le
from backend.profiles import EDC15_DEMO_PROFILE


def test_additive_checksum_known_value():
    # 0x0001 + 0x0002 + 0x0003 = 6; odd trailing byte is added as 8-bit.
    assert sum16_words_le(b"\x01\x00\x02\x00\x03\x00", 0, 6) == 6
    assert sum16_words_le(b"\x01\x00\x02\x00\x03", 0, 5) == 6  # 1 + 2 + 3


def test_stock_demo_is_unsealed(demo_bin):
    result = ChecksumEngine(demo_bin, EDC15_DEMO_PROFILE).verify()
    assert result["overall_status"] == "UNSEALED"
    assert result["is_valid"] is False


def test_seal_produces_valid_signature(demo_bin):
    sealed = ChecksumEngine(demo_bin, EDC15_DEMO_PROFILE).seal()
    assert len(sealed) == len(demo_bin)
    result = ChecksumEngine(bytes(sealed), EDC15_DEMO_PROFILE).verify()
    assert result["overall_status"] == "VALID"
    assert result["is_valid"] is True


def test_stored_value_is_calculated_not_constant(demo_bin):
    region = EDC15_DEMO_PROFILE.checksum_regions[0]
    sealed = ChecksumEngine(demo_bin, EDC15_DEMO_PROFILE).seal()
    stored = int.from_bytes(
        sealed[region.stored_offset:region.stored_offset + region.stored_size], "little"
    )
    expected = sum16_words_le(bytes(sealed), region.start, region.end)
    assert stored == expected
    assert stored != 0xFFFFFFFF


def test_tampering_is_detected(demo_bin):
    region = EDC15_DEMO_PROFILE.checksum_regions[0]
    sealed = ChecksumEngine(demo_bin, EDC15_DEMO_PROFILE).seal()
    tampered = bytearray(sealed)
    tampered[0x4D200] ^= 0xFF
    result = ChecksumEngine(bytes(tampered), EDC15_DEMO_PROFILE).verify()
    assert result["overall_status"] == "INVALID"
    assert result["can_export"] is False


def test_resealing_after_tamper_restores_validity(demo_bin):
    tampered = bytearray(demo_bin)
    tampered[0x4D200] ^= 0xFF
    resealed = ChecksumEngine(bytes(tampered), EDC15_DEMO_PROFILE).seal()
    result = ChecksumEngine(bytes(resealed), EDC15_DEMO_PROFILE).verify()
    assert result["overall_status"] == "VALID"


def test_out_of_bounds_region_is_rejected(demo_bin):
    with pytest.raises(ChecksumError):
        sum16_words_le(demo_bin, 0, len(demo_bin) + 1)
