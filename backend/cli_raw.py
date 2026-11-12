"""
Deneysel dışa aktarma CLI (salt okunur profiller için, açık onayla).

    python backend/cli_raw.py --input in.bin --patches patches.json \
        --output out.bin --ack-unverified

patches.json: [{"offset": "0x1C1234", "hex": "01 02 03"}, ...]
Çıkış kodları: 0 başarılı, 6 onay yok, 7 yama reddedildi, 1 diğer.
"""

from __future__ import annotations

import argparse
import json
import os
import sys

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from raw_edit import RawEditError, export_experimental, parse_patches


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="AutoTune AI deneysel ham düzenleme")
    ap.add_argument("--input", required=True)
    ap.add_argument("--patches", required=True)
    ap.add_argument("--output", required=True)
    ap.add_argument(
        "--ack-unverified",
        action="store_true",
        help="Checksum doğrulanmamış dosya üretildiğini anladığımı onaylıyorum",
    )
    args = ap.parse_args()

    if not args.ack_unverified:
        print(json.dumps({
            "success": False, "error": "ACK_REQUIRED",
            "detail": "--ack-unverified olmadan deneysel dışa aktarma yapılmaz.",
        }, ensure_ascii=False))
        sys.exit(6)
    try:
        with open(args.patches, "r", encoding="utf-8") as handle:
            patches = parse_patches(json.load(handle))
        result = export_experimental(args.input, args.output, patches)
    except RawEditError as exc:
        print(json.dumps({"success": False, "error": exc.code, "detail": str(exc)},
                         ensure_ascii=False))
        sys.exit(7)
    except Exception as exc:  # CLI sözleşmesi: her zaman JSON
        print(json.dumps({"success": False, "error": str(exc)}, ensure_ascii=False))
        sys.exit(1)
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
