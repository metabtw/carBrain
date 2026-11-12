"""
Salt okunur (inspection-only) ECU profili testleri
==================================================

Gerçek müşteri dump'ları (ör. Hyundai i30 1.6 CRDi / Bosch EDC16C39) kimlik
olarak tanınmalı, böylece kullanıcı dosyayı yükleyip inceleyebilmeli. Ancak bu
yazılım sürümü için doğrulanmış harita tanımı (XDF/DAMOS) olmadığı sürece
hiçbir bayt yazılmamalı, checksum imzalanmamalı ve dosya dışa aktarılmamalı.

Bu testler o güvenlik sözleşmesini doğrular.
"""

from __future__ import annotations

import pytest

from backend.checksum import ChecksumEngine, ChecksumError
from backend.profiles import (
    EDC15_DEMO_PROFILE,
    UnsupportedEcuError,
    detect_profile,
)
from backend.parser import EcuBinary

# EDC16C39 tanımlama alanının gerçek dump'taki bayt dizilimi.
EDC16_SIZE = 2 * 1024 * 1024
EDC16_IDENT_OFFSET = 0x1C0607
EDC16_IDENT = b"|99/1/EDC16C39/147/D373/X/0X0C000I_000/____/19810101/"
EDC16_SW_OFFSET = 0x1C0010
EDC16_SW = b"1037391494P373C0"


@pytest.fixture()
def edc16_bin() -> bytes:
    """2 MB'lık sentetik ama gerçekçi EDC16C39 dump'ı (sadece kimlik alanı dolu)."""
    data = bytearray(b"\xff" * EDC16_SIZE)
    data[EDC16_IDENT_OFFSET:EDC16_IDENT_OFFSET + len(EDC16_IDENT)] = EDC16_IDENT
    data[EDC16_SW_OFFSET:EDC16_SW_OFFSET + len(EDC16_SW)] = EDC16_SW
    return bytes(data)


def test_edc16_is_recognised(edc16_bin):
    profile = detect_profile(edc16_bin)
    assert profile.ecu_family == "EDC16C39"
    assert profile.tuning_enabled is False
    assert profile.flash_size == EDC16_SIZE


def test_edc16_identity_reports_software_version(edc16_bin):
    profile = detect_profile(edc16_bin)
    identity = EcuBinary(edc16_bin, profile).identity().as_dict()
    assert "EDC16C39" in identity["identifier_text"]
    assert identity["software_version"].startswith("1037391494")
    assert identity["read_only"] is True
    assert identity["tuning_enabled"] is False


def test_edc16_profile_has_no_maps_and_no_checksum_regions(edc16_bin):
    profile = detect_profile(edc16_bin)
    assert profile.maps == {}
    assert profile.checksum_regions == ()


def test_edc16_checksum_is_not_applicable(edc16_bin):
    profile = detect_profile(edc16_bin)
    verification = ChecksumEngine(edc16_bin, profile).verify()
    assert verification["overall_status"] == "NOT_APPLICABLE"
    assert verification["can_export"] is False
    assert verification["blocks"] == []


def test_edc16_can_never_be_sealed(edc16_bin):
    profile = detect_profile(edc16_bin)
    with pytest.raises(ChecksumError) as excinfo:
        ChecksumEngine(edc16_bin, profile).seal()
    assert excinfo.value.code == "CHECKSUM_REGION_MISSING"


def test_edc16_unknown_map_is_rejected(edc16_bin):
    profile = detect_profile(edc16_bin)
    binary = EcuBinary(edc16_bin, profile)
    with pytest.raises(KeyError):
        binary.get_map("boost")


def test_edc16_reads_arbitrary_address_readonly(edc16_bin):
    """Serbest adres okuması profil gerektirmez ve baytları değiştirmez."""
    binary = EcuBinary(edc16_bin, profile=None, strict=False)
    result = binary.get_matrix(offset=0x1C0000, rows=4, cols=4, factor=1.0)
    assert result["rows"] == 4
    assert len(result["matrix"]) == 4
    assert result["address"] == "0x1C0000"


def test_edc15_profile_is_still_writable(demo_bin):
    assert EDC15_DEMO_PROFILE.tuning_enabled is True
    profile = detect_profile(demo_bin)
    assert profile.id == EDC15_DEMO_PROFILE.id


def test_wrong_size_is_still_rejected():
    """Yanlış boyutlu dosya hiçbir profile eşleşmemeli."""
    with pytest.raises(UnsupportedEcuError) as excinfo:
        detect_profile(b"\x00" * 1024)
    assert excinfo.value.reason == "PROFILE_NOT_FOUND"
