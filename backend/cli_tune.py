"""
CLI export bridge used by the Next.js API route.

The web layer must never assemble a binary itself.  This command performs the
whole safe pipeline in one process:

    read -> detect profile -> guardrails -> NumPy modify -> seal -> verify -> write

Exit codes: 0 success, 2 safety rejection, 3 checksum failure, 4 unsupported ECU.
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
    from .checksum import ChecksumEngine, ChecksumError
    from .guardrails import GuardrailEngine, SafetyViolation, TuningRequest
    from .modifier import apply_tuning
    from .profiles import UnsupportedEcuError, detect_profile
except ImportError:  # pragma: no cover
    from checksum import ChecksumEngine, ChecksumError
    from guardrails import GuardrailEngine, SafetyViolation, TuningRequest
    from modifier import apply_tuning
    from profiles import UnsupportedEcuError, detect_profile


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="AutoTune AI safe export CLI")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--turbo", type=float, default=0.0)
    parser.add_argument("--injection", type=float, default=0.0)
    parser.add_argument("--throttle", type=float, default=0.0)
    parser.add_argument("--timing", type=float, default=None)
    parser.add_argument("--rail", type=float, default=None)
    args = parser.parse_args()

    try:
        with open(args.input, "rb") as handle:
            data = handle.read()
        profile = detect_profile(data)
        request = TuningRequest(
            turbo_pct=args.turbo,
            injection_pct=args.injection,
            throttle_pct=args.throttle,
            timing_advance_deg=args.timing,
            rail_pressure_bar=args.rail,
        )
        guardrail = GuardrailEngine().enforce(request)
        patched, reports = apply_tuning(
            data, profile, args.turbo, args.injection, args.throttle
        )
        sealed = ChecksumEngine(patched, profile).seal()
        verification = ChecksumEngine(sealed, profile).verify()
        if verification["overall_status"] != "VALID":
            raise ChecksumError("İmzalama sonrası doğrulama başarısız.")
        with open(args.output, "wb") as handle:
            handle.write(sealed)
        print(
            json.dumps(
                {
                    "success": True,
                    "output": args.output,
                    "checksum": verification,
                    "guardrail": guardrail.as_dict(),
                    "change_reports": [report.as_dict() for report in reports],
                },
                ensure_ascii=False,
            )
        )
    except SafetyViolation as exc:
        print(json.dumps({"success": False, "safety": exc.as_dict()}, ensure_ascii=False))
        sys.exit(2)
    except UnsupportedEcuError as exc:
        print(
            json.dumps(
                {"success": False, "error": "UNSUPPORTED_ECU", "detail": str(exc)},
                ensure_ascii=False,
            )
        )
        sys.exit(4)
    except ChecksumError as exc:
        print(
            json.dumps(
                {"success": False, "error": "CHECKSUM_ERROR", "detail": str(exc)},
                ensure_ascii=False,
            )
        )
        sys.exit(3)
    except Exception as exc:  # pragma: no cover
        print(json.dumps({"success": False, "error": str(exc)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
