"""
Backwards-compatible parser entry point.

The real implementation lives in :mod:`backend.parser`.  The Next.js bridge and
the original CLI call this module, so we keep the public surface stable while
all new safety checks live in one place.
"""

from __future__ import annotations

try:
    from .parser import EcuBinary, EcuBinaryParser, EcuIdentity, main
except ImportError:  # pragma: no cover
    from parser import EcuBinary, EcuBinaryParser, EcuIdentity, main

__all__ = ["EcuBinary", "EcuBinaryParser", "EcuIdentity", "main"]

if __name__ == "__main__":
    main()
