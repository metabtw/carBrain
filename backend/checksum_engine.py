"""
Backwards-compatible checksum entry point.

The original project imported ``Edc15ChecksumEngine`` from this file.  It now
delegates to :mod:`backend.checksum` and :mod:`backend.modifier` so there is a
single implementation of the arithmetic and a single place where the safety and
signature rules are enforced.
"""

from __future__ import annotations

import json
import os
import struct
import sys
from typing import Any, Dict, Tuple

try:
    from .checksum import ChecksumEngine, sum16_words_le, verify_checksum, seal_checksum
    from .guardrails import GuardrailEngine, TuningRequest
    from .modifier import apply_tuning
    from .profiles import EDC15_DEMO_PROFILE, EcuProfile
except ImportError:  # pragma: no cover - direct script execution
    from checksum import ChecksumEngine, sum16_words_le, verify_checksum, seal_checksum
    from guardrails import GuardrailEngine, TuningRequest
    from modifier import apply_tuning
    from profiles import EDC15_DEMO_PROFILE, EcuProfile


class Edc15ChecksumEngine:
    """Compatibility facade used by the Next.js export bridge."""

    def __init__(self, data: bytes, profile: EcuProfile = EDC15_DEMO_PROFILE):
        self.data = bytes(data)
        self.profile = profile
        self._engine = ChecksumEngine(self.data, profile)

    # ------------------------------------------------------------------ legacy
    def calculate_block_checksum(self, start: int, end: int) -> Tuple[int, int]:
        total = sum16_words_le(self.data, start, end)
        return total, (~total) & 0xFFFFFFFF

    def verify_all_blocks(self) -> Dict[str, Any]:
        result = self._engine.verify()
        result["blocks"] = [
            {
                "block": block["name"],
                "range": block["range"],
                "checksum": block["stored_hex"],
                "calculated_checksum": block["calculated_hex"],
                "status": block["status"],
                "algorithm": block["algorithm"],
            }
            for block in result["blocks"]
        ]
        return result

    def seal(self) -> bytearray:
        return self._engine.seal()

    # ----------------------------------------------------------------- patched
    def patch_maps(
        self,
        turbo_pct: float,
        injection_pct: float,
        throttle_pct: float,
        *,
        enforce_guardrails: bool = True,
    ) -> bytearray:
        """
        Apply tuning + checksum in the legacy order, but with guardrails and a
        real signature self-test.  Raises ``SafetyViolation`` for unsafe input
        and ``ChecksumError`` if the sealed file does not verify.
        """
        if enforce_guardrails:
            GuardrailEngine().enforce(
                TuningRequest(
                    turbo_pct=turbo_pct,
                    injection_pct=injection_pct,
                    throttle_pct=throttle_pct,
                )
            )
        patched, _reports = apply_tuning(
            self.data,
            self.profile,
            turbo_pct,
            injection_pct,
            throttle_pct,
        )
        return ChecksumEngine(patched, self.profile).seal()


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    stock_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "data",
        "edc15_19tdi_stock.bin",
    )
    if not os.path.exists(stock_path):
        raise SystemExit(f"Dosya bulunamadı: {stock_path}")
    with open(stock_path, "rb") as handle:
        engine = Edc15ChecksumEngine(handle.read())
    print(json.dumps(engine.verify_all_blocks(), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
