"""The "game engine": predicts which pack you'll need next and warms it up early.

Games load the next room while you're walking toward it. Here the signals are:
  - open file extensions   (you opened app.py -> python)
  - recent requests        (the last few packs you used: "movement direction")
  - the router's guess     (what the current prompt looks like)

Warming a pack means:
  1. its search index is kept in RAM (cheap, instant searches), and
  2. if a LoRA adapter exists for it, llama-server switches to it
     (a small file, so it crosses the eGPU cable quickly).

Usage (demo):
  python -m src.prefetch --files app.py utils.py --prompt "add a retry decorator"
"""
import argparse
import json
import sys
import urllib.request
from collections import Counter, OrderedDict, deque

from . import library, router
from .config import cfg

EXT_TO_PACK = {
    ".ts": "typescript", ".mts": "typescript", ".cts": "typescript", ".d.ts": "typescript",
    ".tsx": "react", ".jsx": "react",
    ".js": "node", ".mjs": "node", ".cjs": "node",
}
# file names that point at a pack no matter the extension
NAME_TO_PACK = {"package.json": "node", "tsconfig.json": "typescript", "vite.config.ts": "react"}

# how much each signal counts when guessing the next pack
W_ROUTER, W_FILES, W_HISTORY = 0.5, 0.3, 0.2


class Prefetcher:
    def __init__(self, index=None, history_len=5):
        self.index = index or library.load_index()
        self.warm = OrderedDict()            # pack -> index data, most recent last
        self.budget = cfg()["prefetch"]["ram_budget_packs"]
        self.history = deque(maxlen=history_len)
        self.active_lora = None
        self.stats = Counter()               # hits/misses: did we guess right in advance?

    # ---------- prediction ----------
    def score(self, prompt="", files=()):
        scores = Counter()
        if prompt:
            for pack, conf in router.predict(prompt)["pack_ranking"]:
                scores[pack] += W_ROUTER * conf
        file_packs = []
        for f in files:
            name = f.replace("\\", "/").rsplit("/", 1)[-1].lower()
            ext = name[name.rfind("."):] if "." in name else ""
            pack = NAME_TO_PACK.get(name) or EXT_TO_PACK.get(ext)
            if pack:
                file_packs.append(pack)
        for pack, n in Counter(file_packs).items():
            scores[pack] += W_FILES * n / len(file_packs)
        for pack, n in Counter(self.history).items():
            scores[pack] += W_HISTORY * n / len(self.history)
        return scores.most_common()

    # ---------- loading ----------
    def warm_up(self, pack):
        if pack not in self.index:
            return
        if pack in self.warm:
            self.warm.move_to_end(pack)
            return
        self.warm[pack] = self.index[pack]
        while len(self.warm) > self.budget:
            self.warm.popitem(last=False)     # evict least recently used

    def prefetch(self, files=(), upcoming_prompt=""):
        """Call when context changes (file opened, user typing). Warms top 2 guesses."""
        guesses = [p for p, _ in self.score(upcoming_prompt, files)[:2]]
        for p in reversed(guesses):
            self.warm_up(p)
        if guesses:
            self.set_lora(guesses[0])
        return guesses

    def set_lora(self, pack):
        ids = cfg()["prefetch"].get("lora_ids") or {}
        if pack == self.active_lora or not ids:
            return
        base = cfg()["models"]["7b"]["url"].removesuffix("/v1")
        body = [{"id": i, "scale": 1.0 if p == pack else 0.0} for p, i in ids.items()]
        try:
            req = urllib.request.Request(f"{base}/lora-adapters", json.dumps(body).encode(),
                                         {"Content-Type": "application/json"})
            urllib.request.urlopen(req, timeout=5)
            self.active_lora = pack
        except OSError as e:
            print(f"(lora switch skipped: {e})", file=sys.stderr)

    # ---------- use ----------
    def retrieve(self, prompt, pack, k=None):
        """Search for the request. Counts whether the pack was already warm (a 'hit')."""
        self.stats["hit" if pack in self.warm else "miss"] += 1
        self.warm_up(pack)
        self.history.append(pack)
        k = k or cfg()["library"]["top_k"]
        hits = library.search_pack(self.warm[pack], prompt, k) if pack in self.warm else []
        return [dict(h, pack=pack) for h in hits]


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--files", nargs="*", default=[])
    ap.add_argument("--prompt", default="")
    a = ap.parse_args(argv)
    pf = Prefetcher()
    print("scores:", [(p, round(s, 2)) for p, s in pf.score(a.prompt, a.files)])
    print("warmed:", pf.prefetch(a.files, a.prompt))


if __name__ == "__main__":
    sys.exit(main())
