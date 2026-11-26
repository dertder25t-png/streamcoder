"""Full request path: router -> prefetcher/library -> prompt -> LLM.

Usage:
  python -m src.pipeline "write a bash loop over files" --dry-run   # show the prompt only
  python -m src.pipeline "fix my flexbox" --files style.css          # needs llama-server
"""
import argparse
import sys

from . import llm, router
from .config import cfg
from .prefetch import Prefetcher

SYSTEM = ("You are a careful coding assistant. Reference recipes may be provided; "
          "use them when they fit, ignore them when they don't. "
          "Put final code in one fenced code block.")

_PF = None


def prefetcher():
    global _PF
    if _PF is None:
        _PF = Prefetcher()
    return _PF


def build_messages(prompt: str, files=(), system: str = None):
    route = router.predict(prompt)
    pf = prefetcher()
    if route["trusted"]:
        hits = pf.retrieve(prompt, route["pack"])
    else:  # unsure: look in the top two packs
        hits = []
        for pack, _ in route["pack_ranking"][:2]:
            hits += pf.retrieve(prompt, pack)
        hits = sorted(hits, key=lambda h: -h["score"])[: cfg()["library"]["top_k"]]

    min_score = cfg()["library"].get("min_score", 0)
    hits = [h for h in hits if h["score"] >= min_score]
    budget = cfg()["library"]["max_context_chars"]
    refs, used = [], 0
    for h in hits:
        if used + len(h["text"]) > budget:
            break
        refs.append(f"--- {h['pack']}/{h['source']} ---\n{h['text']}")
        used += len(h["text"])

    user = prompt if not refs else "Reference recipes:\n" + "\n\n".join(refs) + f"\n\nTask:\n{prompt}"
    msgs = [{"role": "system", "content": system or SYSTEM}, {"role": "user", "content": user}]
    return msgs, route, hits


def answer(prompt: str, files=(), model_key=None):
    msgs, route, hits = build_messages(prompt, files)
    # easy -> 7B. hard -> still 7B by default; flip to "14b" once you've measured it's worth it
    model_key = model_key or "7b"
    out = llm.chat(model_key, msgs)
    return dict(out, route=route, sources=[h["source"] for h in hits])


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("prompt", nargs="+")
    ap.add_argument("--files", nargs="*", default=[])
    ap.add_argument("--model", default=None)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args(argv)
    prompt = " ".join(a.prompt)
    prefetcher().prefetch(a.files, prompt)
    if a.dry_run:
        msgs, route, _ = build_messages(prompt, a.files)
        print("ROUTE:", route["pack"], route["pack_confidence"], route["difficulty"])
        print("=" * 60)
        print(msgs[1]["content"])
        return
    out = answer(prompt, a.files, a.model)
    print(out["text"])
    print(f"\n[{out['route']['pack']} | {out['seconds']}s | {out['tokens_per_sec']} tok/s | "
          f"sources: {', '.join(out['sources']) or 'none'}]")


if __name__ == "__main__":
    sys.exit(main())
