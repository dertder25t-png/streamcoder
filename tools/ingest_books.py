"""Turn your own book files into library chunks for one pack.

  python tools/ingest_books.py data/books/python_crash_course.pdf --pack python
  python tools/ingest_books.py data/books/*.epub --pack web

Writes markdown chunks to data/library/<pack>/books/ (git-ignored).
Then run: python -m src.library build

For personal, local use with books you own. Don't commit or share the output.
Tip: scanned PDFs have no text layer. Those need OCR first.
"""
import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def read_pdf(p):
    from pypdf import PdfReader
    return "\n".join((page.extract_text() or "") for page in PdfReader(p).pages)


def read_epub(p):
    import ebooklib
    from bs4 import BeautifulSoup
    from ebooklib import epub
    book = epub.read_epub(str(p))
    parts = []
    for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
        soup = BeautifulSoup(item.get_content(), "html.parser")
        for pre in soup.find_all("pre"):      # keep code blocks as code
            pre.replace_with(f"\n```\n{pre.get_text()}\n```\n")
        parts.append(soup.get_text("\n"))
    return "\n".join(parts)


def clean(text):
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split(text, size=1400):
    paras, buf = text.split("\n\n"), ""
    for para in paras:
        if len(buf) + len(para) > size and buf:
            yield buf.strip()
            buf = ""
        buf += para + "\n\n"
    if buf.strip():
        yield buf.strip()


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="+")
    ap.add_argument("--pack", required=True)
    a = ap.parse_args(argv)
    out = ROOT / "data" / "library" / a.pack / "books"
    out.mkdir(parents=True, exist_ok=True)
    for f in map(Path, a.files):
        reader = {".pdf": read_pdf, ".epub": read_epub}.get(f.suffix.lower(), lambda p: p.read_text())
        chunks = list(split(clean(reader(f))))
        for i, c in enumerate(chunks):
            (out / f"{f.stem}_{i:04d}.md").write_text(f"# {f.stem} part {i}\n\n{c}\n")
        print(f"{f.name}: {len(chunks)} chunks -> {out.relative_to(ROOT)}")


if __name__ == "__main__":
    sys.exit(main())
