"""
Metin kodlaması koruma testi
============================

Türkçe karakterler (ı, ş, ğ, ç, ö, ü) UTF-8 olarak saklanmalıdır. Windows
PowerShell 5.1'de `Get-Content -Raw` + `Set-Content -Encoding utf8` gibi bir
round-trip, UTF-8 baytlarını ANSI (Windows-1254) olarak okuyup yeniden yazdığı
için metni iki karakterli bozuk dizilere (Latin-1/CP1252 artıkları) çevirebiliyor
ve dosya başına BOM ekleyebiliyor.

Bu test, bu tür bir bozulmanın depoya tekrar girmesini engeller.
"""

from __future__ import annotations

import os

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

SCAN_DIRS = ("app", "components", "lib", "backend")
SCAN_EXTENSIONS = (".ts", ".tsx", ".py", ".md", ".css", ".json")

SKIP_DIRS = {".git", "node_modules", ".next", "__pycache__", ".venv", "venv", "tests"}

# UTF-8 metnin Latin-1/CP1252 olarak yanlış okunmasından doğan tipik ikili
# diziler. Yorumlarda bilerek kaçış dizisi kullanılmıyor; dosyanın kendisi de
# bu taramadan geçtiği için bozuk örnek metin içermemeli.
MOJIBAKE_MARKERS = (
    "\u00c3\u00bc",  # u-umlaut
    "\u00c3\u00a7",  # c-cedilla
    "\u00c3\u00b6",  # o-umlaut
    "\u00c4\u00b1",  # dotless i
    "\u00c5\u0178",  # s-cedilla
    "\u00c4\u0178",  # g-breve
    "\ufffd",        # U+FFFD replacement char (veri kaybı)
)

BOM = b"\xef\xbb\xbf"


def _source_files():
    for directory in SCAN_DIRS:
        base = os.path.join(ROOT, directory)
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [name for name in dirnames if name not in SKIP_DIRS]
            for filename in filenames:
                if filename.endswith(SCAN_EXTENSIONS):
                    yield os.path.join(dirpath, filename)

    # Depo kökündeki doküman/ayar dosyaları
    for filename in os.listdir(ROOT):
        path = os.path.join(ROOT, filename)
        if os.path.isfile(path) and filename.endswith((".md", ".json")):
            if filename in {"package-lock.json"}:
                continue
            yield path


def test_no_mojibake_in_sources():
    offenders = []
    for path in _source_files():
        with open(path, "rb") as handle:
            raw = handle.read()
        text = raw.decode("utf-8", errors="replace")
        found = [marker for marker in MOJIBAKE_MARKERS if marker in text]
        if found:
            offenders.append((os.path.relpath(path, ROOT), found))
    assert offenders == [], "Bozuk Türkçe karakter (mojibake) bulundu: " + repr(offenders)


def test_no_utf8_bom_in_sources():
    offenders = []
    for path in _source_files():
        with open(path, "rb") as handle:
            if handle.read(3) == BOM:
                offenders.append(os.path.relpath(path, ROOT))
    assert offenders == [], "UTF-8 BOM bulundu (PowerShell 5.1 kalıntısı): " + repr(offenders)


@pytest.mark.parametrize(
    "relative_path",
    [
        "app/page.tsx",
        "app/presets/page.tsx",
        "components/ai-assistant.tsx",
        "components/advanced-parameters.tsx",
        "lib/types.ts",
    ],
)
def test_key_files_keep_turkish_characters(relative_path):
    path = os.path.join(ROOT, relative_path)
    text = open(path, encoding="utf-8").read()
    assert "\u0131" in text or "\u015f" in text, (
        f"{relative_path} içinde Türkçe karakter bulunamadı; dosya bozulmuş olabilir."
    )
