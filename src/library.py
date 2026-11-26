"""The library: clean, trusted code recipes split into packs (one folder per pack).

Each pack gets its own small search index, so a request only searches the "room"
it's in, like a game only loading the level you're standing in.

Files: any .md/.txt under data/library/<pack>/ (including <pack>/books/ from
tools/ingest_books.py). Long files are split into chunks on headings.

Usage:
  python -m src.library build
  python -m src.library search "read a csv" --pack python
"""
import argparse
import re
import sys

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import linear_kernel

from .config import cfg, path

CHUNK_CHARS = 1500


def _chunks(text: str, source: str):
    """Split on markdown headings, then on paragraphs, never mid-sentence.
    Each chunk starts with "file > heading" so search and the model know the context."""
    title = source.rsplit("/", 1)[-1].rsplit(".", 1)[0].replace("_", " ")
    for section in re.split(r"\n(?=#{1,3} )", text):
        section = section.strip()
        if not section:
            continue
        heading = section.splitlines()[0].lstrip("# ").strip() if section.startswith("#") else ""
        prefix = f"[{title} > {heading}]\n" if heading else f"[{title}]\n"
        buf = ""
        for para in re.split(r"\n\s*\n", section):
            if buf and len(buf) + len(para) > CHUNK_CHARS:
                yield {"source": source, "text": prefix + buf.strip()}
                buf = ""
            buf += para + "\n\n"
        if buf.strip():
            yield {"source": source, "text": prefix + buf.strip()[: CHUNK_CHARS * 2]}


def build(report=True):
    root = path(cfg()["library"]["root"])
    packs = {}
    for pack_dir in sorted(p for p in root.iterdir() if p.is_dir()):
        docs = []
        for f in sorted(pack_dir.rglob("*")):
            if f.suffix in {".md", ".txt"} and f.is_file():
                docs.extend(_chunks(f.read_text(errors="ignore"), str(f.relative_to(pack_dir))))
        if not docs:
            continue
        vec = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, stop_words="english")
        matrix = vec.fit_transform(d["text"] for d in docs)
        packs[pack_dir.name] = {"docs": docs, "vec": vec, "matrix": matrix}
        if report:
            print(f"  {pack_dir.name:<8} {len(docs):>4} chunks")
    joblib.dump(packs, path(cfg()["library"]["index_path"]))
    if report:
        print(f"indexed {len(packs)} packs")
    return packs


def load_index():
    p = path(cfg()["library"]["index_path"])
    return joblib.load(p) if p.exists() else build(report=False)


RECIPE_BOOST = 1.5  # hand-written recipes beat raw docs when scores are close


def search_pack(pack_data: dict, query: str, k: int):
    scores = linear_kernel(pack_data["vec"].transform([query]), pack_data["matrix"])[0]
    scores = scores * [1.0 if d["source"].startswith("docs") else RECIPE_BOOST for d in pack_data["docs"]]
    best = scores.argsort()[::-1][:k]
    return [dict(pack_data["docs"][i], score=round(float(scores[i]), 3)) for i in best if scores[i] > 0]


def search(query: str, packs=None, k=None, index=None):
    """Search only the given packs (None = all). Returns best chunks first."""
    index = index or load_index()
    k = k or cfg()["library"]["top_k"]
    names = packs or list(index)
    hits = []
    for name in names:
        if name in index:
            hits += [dict(h, pack=name) for h in search_pack(index[name], query, k)]
    return sorted(hits, key=lambda h: -h["score"])[:k]


def main(argv=None):
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("build")
    s = sub.add_parser("search")
    s.add_argument("query", nargs="+")
    s.add_argument("--pack", action="append")
    a = ap.parse_args(argv)
    if a.cmd == "build":
        build()
    else:
        for h in search(" ".join(a.query), a.pack):
            first = h["text"].splitlines()[0]
            print(f"[{h['score']:.2f}] {h['pack']}/{h['source']}: {first}")


if __name__ == "__main__":
    sys.exit(main())
