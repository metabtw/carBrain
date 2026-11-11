"""
Read-only inspection CLI for uploaded binaries.

Usage:
    python backend/cli_inspect.py --file path/to/file.bin

Returns strict JSON.  No bytes are modified and no offsets are guessed: an
unrecognised file simply returns an error with the reason.
"""

from __future__ import annotations

import argparse
import json
import os
import sys

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

try:
    from .checksum import ChecksumEngine
    from .parser import EcuBinary
    from .profiles import UnsupportedEcuError, detect_profile
except ImportError:  # pragma: no cover
    from checksum import ChecksumEngine
    from parser import EcuBinary
    from profiles import UnsupportedEcuError, detect_profile


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="AutoTune AI binary inspector")
    parser.add_argument("--file", required=True)
    args = parser.parse_args()
    try:
        with open(args.file, "rb") as handle:
            data = handle.read()
        profile = detect_profile(data)
        binary = EcuBinary(data, profile)
        result = {
            "success": True,
            "identity": binary.identity().as_dict(),
            "checksum": ChecksumEngine(data, profile).verify(),
            "maps": [definition.as_dict() for definition in profile.maps.values()],
            "message": "Dosya doğrulandı. Kayıtlı ECU profiliyle eşleşiyor.",
        }
    except UnsupportedEcuError as exc:
        print(
            json.dumps(
                {
                    "success": False,
                    "error": "UNSUPPORTED_ECU",
                    "reason": exc.reason,
                    "detail": str(exc),
                },
                ensure_ascii=False,
            )
        )
        sys.exit(4)
    except Exception as exc:  # pragma: no cover
        print(json.dumps({"success": False, "error": str(exc)}, ensure_ascii=False))
        sys.exit(1)
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
