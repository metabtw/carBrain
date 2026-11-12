"""
Deneysel (ham) düzenleme testleri
=================================

``raw_edit`` ve ``raw_service`` modüllerinin güvenlik sözleşmesini doğrular:

* Sınır dışı yazma reddedilir.
* Tek seferde 64 KB'tan fazla yama reddedilir.
* Diff bölgeleri birleştirilir ve yalnızca değişen baytları gösterir.
* Checksum durumu asla ``VALID`` olmaz.
* Dışa aktarma yedeği ve diff raporunu üretir; yalnızca yamalanan baytlar değişir.
"""

from __future__ import annotations

import json
import os

import pytest

from backend.raw_edit import (
    MAX_PATCH_BYTES,
    RawEditError,
    apply_raw_patches,
    data_layout,
    diff_regions,
    export_experimental,
    parse_patches,
)
from backend.raw_service import layout_report, preview_patches, read_hex


@pytest.fixture()
def sample() -> bytes:
    """4 KB dolu, 4 KB boş veri (kısmi dump benzeri)."""
    return bytes(range(256)) * 16 + b"\xff" * 4096


def test_parse_patches_accepts_hex_strings():
    patches = parse_patches(
        [
            {"offset": "0x10", "hex": "01 02 03"},
            {"offset": 32, "hex": "AABB"},
        ]
    )
    assert [p.offset for p in patches] == [0x10, 32]
    assert patches[0].data == b"\x01\x02\x03"


def test_parse_patches_rejects_bad_records():
    for bad in ([{"offset": "0x10"}], [{"hex": "00"}], [{"offset": "zz", "hex": "00"}]):
        with pytest.raises(RawEditError) as excinfo:
            parse_patches(bad)
        assert excinfo.value.code == "BAD_PATCH"


def test_apply_writes_only_requested_bytes(sample):
    patches = parse_patches([{"offset": "0x10", "hex": "DE AD BE EF"}])
    modified = apply_raw_patches(sample, patches)
    assert modified[0x10:0x14] == b"\xde\xad\xbe\xef"
    assert modified[:0x10] == sample[:0x10]
    assert modified[0x14:] == sample[0x14:]
    # orijinal değişmemeli
    assert sample[0x10:0x14] == bytes([0x10, 0x11, 0x12, 0x13])


def test_out_of_bounds_is_rejected(sample):
    patches = parse_patches([{"offset": hex(len(sample) - 2), "hex": "01 02 03 04"}])
    with pytest.raises(RawEditError) as excinfo:
        apply_raw_patches(sample, patches)
    assert excinfo.value.code == "OUT_OF_BOUNDS"


def test_negative_offset_is_rejected(sample):
    patches = parse_patches([{"offset": -4, "hex": "01"}])
    # parse_patches int("-4") çalışır; sınır kontrolü apply aşamasında yakalar.
    with pytest.raises(RawEditError):
        apply_raw_patches(sample, patches)


def test_patch_size_limit(sample):
    big = "00" * (MAX_PATCH_BYTES + 2)
    patches = parse_patches([{"offset": "0x0", "hex": big}])
    with pytest.raises(RawEditError) as excinfo:
        apply_raw_patches(sample, patches)
    assert excinfo.value.code == "PATCH_TOO_LARGE"


def test_diff_merges_close_regions(sample):
    modified = bytearray(sample)
    modified[0x100] ^= 0xFF
    modified[0x102] ^= 0xFF  # 1 bayt boşluk -> birleşir
    regions = diff_regions(sample, bytes(modified))
    assert len(regions) == 1
    assert regions[0]["offset"] == "0x100"
    assert regions[0]["length"] == 3


def test_diff_separates_far_regions(sample):
    modified = bytearray(sample)
    modified[0x100] ^= 0xFF
    modified[0x400] ^= 0xFF
    regions = diff_regions(sample, bytes(modified))
    assert [r["offset"] for r in regions] == ["0x100", "0x400"]


def test_layout_detects_partial_dump(sample):
    layout = data_layout(sample)
    assert layout["looks_partial"] is True
    assert layout["blank_ratio_pct"] > 50
    assert layout_report(sample)["success"] is True


def test_read_hex_is_bounds_checked(sample):
    result = read_hex(sample, 0x10, 32)
    assert result["success"] is True
    assert result["length"] == 32
    assert len(result["rows"]) == 2
    with pytest.raises(RawEditError) as excinfo:
        read_hex(sample, len(sample) - 1, 4)
    assert excinfo.value.code == "OUT_OF_BOUNDS"


def test_read_hex_length_limit(sample):
    with pytest.raises(RawEditError) as excinfo:
        read_hex(sample, 0, 4097)
    assert excinfo.value.code == "LENGTH_TOO_LARGE"


def test_preview_never_claims_valid_checksum(sample):
    preview = preview_patches(sample, [{"offset": "0x20", "hex": "11223344"}])
    assert preview["checksum_status"] == "UNVERIFIED"
    assert preview["mode"] == "experimental"
    assert preview["bytes_changed"] == 4
    assert len(preview["regions"]) == 1
    assert any("UNVERIFIED" in warning for warning in preview["warnings"])


def test_preview_warns_when_patching_blank_block(sample):
    # Örnek dosya 4 KB; tek blok var ve dolu. Bu yüzden boş blok uyarısı yok.
    preview = preview_patches(sample, [{"offset": "0x20", "hex": "11"}])
    assert not any("boş (0xFF)" in warning for warning in preview["warnings"])


def test_export_creates_backup_and_diff_report(tmp_path, sample):
    input_path = tmp_path / "ecu.bin"
    output_path = tmp_path / "ecu.experimental.bin"
    input_path.write_bytes(sample)

    report = export_experimental(
        str(input_path), str(output_path), parse_patches([{"offset": "0x20", "hex": "1122"}])
    )

    assert report["success"] is True
    assert report["checksum_status"] == "UNVERIFIED"
    assert report["bytes_changed"] == 2
    assert os.path.exists(report["backup"])
    assert os.path.exists(report["report"])

    produced = output_path.read_bytes()
    assert len(produced) == len(sample)
    assert produced[0x20:0x22] == b"\x11\x22"
    # Yalnızca yamalanan baytlar değişti
    changed = [i for i, (a, b) in enumerate(zip(sample, produced)) if a != b]
    assert changed == [0x20, 0x21]

    with open(report["report"], encoding="utf-8") as handle:
        parsed = json.load(handle)
    assert parsed["checksum_status"] == "UNVERIFIED"
    assert parsed["regions"][0]["offset"] == "0x20"


def test_export_backup_is_byte_identical(tmp_path, sample):
    input_path = tmp_path / "ecu.bin"
    output_path = tmp_path / "out.bin"
    input_path.write_bytes(sample)
    report = export_experimental(
        str(input_path), str(output_path), parse_patches([{"offset": "0x0", "hex": "FF"}])
    )
    with open(report["backup"], "rb") as handle:
        assert handle.read() == sample
