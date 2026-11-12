"""
Deneysel mod sorgu CLI'si (salt okunur uçlar için köprü).

    python backend/cli_raw_ops.py --file in.bin --mode layout
    python backend/cli_raw_ops.py --file in.bin --mode hex --offset 0x1C0000 --length 64
    python backend/cli_raw_ops.py --file in.bin --mode preview --patches patches.json

Çıktı her zaman JSON'dur.  Dışa aktarma bu CLI'da YAPILMAZ; onay zorunluluğu
olan ``cli_raw.py`` kullanılır.  Çıkış kodları: 0 başarılı, 7 yama/okuma
reddedildi, 1 diğer.
"""

from __future__ import annotations

import argparse
import json
import os
import sys

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from raw_edit import RawEditError
from raw_service import layout_report, preview_patches, read_hex


def _load_patches(raw: str):
    if raw.lstrip().startswith("["):
        return json.loads(raw)
    with open(raw, "r", encoding="utf-8") as handle:
        return json.load(handle)


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="AutoTune AI deneysel mod sorguları")
    ap.add_argument("--file", required=True)
    ap.add_argument("--mode", required=True, choices=("layout", "hex", "preview"))
    ap.add_argument("--offset", default="0x0")
    ap.add_argument("--length", type=int, default=256)
    ap.add_argument("--patches", default="[]")
    args = ap.parse_args()

    try:
        with open(args.file, "rb") as handle:
            data = handle.read()
        if args.mode == "layout":
            result = layout_report(data)
        elif args.mode == "hex":
            result = read_hex(data, int(str(args.offset), 0), args.length)
        else:
            result = preview_patches(data, _load_patches(args.patches))
    except RawEditError as exc:
        print(
            json.dumps(
                {"success": False, "error": exc.code, "detail": str(exc)},
                ensure_ascii=False,
            )
        )
        sys.exit(7)
    except FileNotFoundError:
        print(
            json.dumps(
                {"success": False, "error": "FILE_NOT_FOUND", "detail": args.file},
                ensure_ascii=False,
            )
        )
        sys.exit(1)
    except Exception as exc:  # pragma: no cover - CLI sözleşmesi
        print(
            json.dumps(
                {"success": False, "error": str(exc)}, ensure_ascii=False
            )
        )
        sys.exit(1)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
