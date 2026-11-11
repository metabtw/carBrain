from __future__ import annotations

import os
import sys

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from backend.generate_edc15_data import generate_stock_edc15_bin  # noqa: E402
from backend.profiles import EDC15_DEMO_PROFILE  # noqa: E402


@pytest.fixture(scope="session")
def demo_bin(tmp_path_factory) -> bytes:
    """Fresh 512 KB demo flash image, generated outside the repository."""
    path = tmp_path_factory.mktemp("ecu") / "edc15_demo.bin"
    generate_stock_edc15_bin(str(path))
    with open(path, "rb") as handle:
        data = handle.read()
    assert len(data) == EDC15_DEMO_PROFILE.flash_size
    return data
