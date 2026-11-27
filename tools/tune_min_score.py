"""Pick library.min_score from the ROUTER's seed questions (never the eval tasks).

For each seed question we take the best library score in its own pack ("on-topic") and the
best score in a pack it does not belong to ("off-topic"). A good cutoff keeps most on-topic
matches and drops most off-topic ones. Prints a small table; you choose and set config.yaml.

  python tools/tune_min_score.py          # boosted scores
  python tools/tune_min_score.py --raw    # raw similarity of the best (boosted) hit, for gate_on: raw
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src import library  # noqa: E402
from src.config import path  # noqa: E402

PACKS = ["typescript", "react", "node"]
RAW = "--raw" in sys.argv


def main():
    index = library.load_index()
    on, off = [], []
    for line in path("data/router/seed.jsonl").read_text().splitlines():
        q = json.loads(line)
        if q["pack"] not in PACKS:
            continue
        own = library.search(q["text"], [q["pack"]], k=1, index=index)
        other = library.search(q["text"], [p for p in PACKS if p != q["pack"]], k=1, index=index)
        key = "raw" if RAW else "score"
        if own:
            on.append(own[0].get(key, own[0]["score"]))
        if other:
            off.append(other[0].get(key, other[0]["score"]))
    on.sort()
    off.sort()
    q = lambda xs, f: xs[min(len(xs) - 1, int(f * len(xs)))]
    print(f"on-topic  n={len(on)}  p10={q(on, .1):.3f} p25={q(on, .25):.3f} median={q(on, .5):.3f}")
    print(f"off-topic n={len(off)} median={q(off, .5):.3f} p75={q(off, .75):.3f} p90={q(off, .9):.3f}")
    print("cutoff  keeps on-topic  drops off-topic")
    lo, hi = min(on + off), max(on + off)
    for i in range(11):
        c = lo + (hi - lo) * i / 10
        print(f"{c:6.3f}  {sum(s >= c for s in on) / len(on):6.0%}       {sum(s < c for s in off) / len(off):6.0%}")


if __name__ == "__main__":
    main()
