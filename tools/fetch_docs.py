"""Download the official, openly licensed docs into the library (no scanning, no OCR).

  python tools/fetch_docs.py            # all sources
  python tools/fetch_docs.py react      # just one
  python -m src.library build           # then re-index

Sources (only the parts we need, via git sparse checkout):
  react       react.dev  src/content/learn + reference     CC BY 4.0
  typescript  TypeScript Handbook (handbook-v2)            CC BY 4.0
  node        Node.js API docs (doc/api)                   MIT

Output goes to data/library/<pack>/docs/ (git-ignored). Each file keeps a
"Source:" line so answers can be traced back. Licenses: see data/library/SOURCES.md.
"""
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = Path(os.environ.get("DOCS_CACHE", ROOT / "data" / "docs_src"))

SOURCES = {
    "react": ("https://github.com/reactjs/react.dev", ["src/content/learn", "src/content/reference"],
              "https://react.dev"),
    "typescript": ("https://github.com/microsoft/TypeScript-Website",
                   ["packages/documentation/copy/en/handbook-v2"], "https://www.typescriptlang.org/docs/handbook/"),
    "node": ("https://github.com/nodejs/node", ["doc/api"], "https://nodejs.org/api/"),
}


def sparse_clone(url: str, paths: list[str], dest: Path):
    if dest.exists():
        subprocess.run(["git", "-C", str(dest), "pull", "-q", "--depth", "1"], check=False)
        return
    subprocess.run(["git", "clone", "-q", "--depth", "1", "--filter=blob:none", "--sparse", url, str(dest)], check=True)
    subprocess.run(["git", "-C", str(dest), "sparse-checkout", "set", "--no-cone", *[f"/{p}/" for p in paths]],
                   check=True)


# Node's doc/api has ~70 files; most code only needs these. Edit to taste.
NODE_KEEP = {"fs", "stream", "http", "https", "events", "path", "crypto", "child_process", "process",
             "buffer", "timers", "url", "readline", "zlib", "worker_threads", "util", "os", "net",
             "globals", "modules", "esm", "packages", "test", "string_decoder", "cli"}


def clean(text: str) -> str:
    text = re.sub(r"\A---\n.*?\n---\n", "", text, flags=re.S)           # frontmatter
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)                   # html comments
    text = re.sub(r"^\s*</?[A-Z][A-Za-z]*[^>]*>\s*$", "", text, flags=re.M)  # MDX wrappers like <Intro>
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def fetch(pack: str):
    url, paths, site = SOURCES[pack]
    repo = CACHE / pack
    print(f"[{pack}] fetching {url} ...")
    sparse_clone(url, paths, repo)
    out = ROOT / "data" / "library" / pack / "docs"
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    n = 0
    for p in paths:
        for f in sorted((repo / p).rglob("*.md")):
            if pack == "node" and f.stem not in NODE_KEEP:
                continue
            body = clean(f.read_text(errors="ignore"))
            if len(body) < 200:
                continue
            rel = f.relative_to(repo / p)
            name = re.sub(r"[^A-Za-z0-9_.-]+", "_", str(rel))
            (out / name).write_text(f"Source: {site} ({rel})\n\n{body}\n")
            n += 1
    print(f"[{pack}] {n} files -> {out.relative_to(ROOT)}")


if __name__ == "__main__":
    for pack in (sys.argv[1:] or SOURCES):
        fetch(pack)
    print("Now run: python -m src.library build")
