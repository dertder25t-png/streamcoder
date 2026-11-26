"""The router: a tiny classifier that decides, before the LLM runs,
  - which knowledge pack a request needs (typescript, react, node, general)
  - how hard it is (easy -> 7B, hard -> 14B or more thinking)
and how confident it is about each.

It's TF-IDF + logistic regression, so it trains in seconds on a CPU and needs no
downloads. Later you can swap in a small embedding model behind the same functions.

Usage:
  python -m src.router train
  python -m src.router predict "my useEffect runs twice"
"""
import argparse
import json
import sys

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score
from sklearn.pipeline import Pipeline, FeatureUnion

from .config import cfg, path

SEED = "data/router/seed.jsonl"


def _load(file=SEED):
    """Rows need text + pack. difficulty is optional (Stack Overflow rows don't have it)."""
    rows = [json.loads(l) for l in path(file).read_text().splitlines() if l.strip()]
    return [r["text"] for r in rows], [r["pack"] for r in rows], [r.get("difficulty") for r in rows]


def _make():
    # word n-grams catch "for loop", char n-grams catch ".py", "div>", "$HOME"
    feats = FeatureUnion([
        ("words", TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True)),
        ("chars", TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4), sublinear_tf=True)),
    ])
    return Pipeline([("feats", feats), ("clf", LogisticRegression(max_iter=2000, C=5.0))])


def train(file=SEED, report=True):
    texts, packs, diffs = _load(file)
    pack_model, diff_model = _make(), _make()
    if report:
        folds = min(5, min(packs.count(p) for p in set(packs)))
        if folds >= 2:
            acc = cross_val_score(_make(), texts, packs, cv=folds).mean()
            print(f"pack accuracy (cross-val, {len(texts)} examples): {acc:.0%}")
    pack_model.fit(texts, packs)
    labeled = [(t, d) for t, d in zip(texts, diffs) if d]
    diff_model.fit([t for t, _ in labeled], [d for _, d in labeled])
    out = path(cfg()["router"]["model_path"])
    joblib.dump({"pack": pack_model, "difficulty": diff_model}, out)
    if report:
        print(f"saved -> {out.relative_to(path('.'))}")


_MODELS = None


def _models():
    global _MODELS
    if _MODELS is None:
        p = path(cfg()["router"]["model_path"])
        if not p.exists():
            train(report=False)
        _MODELS = joblib.load(p)
    return _MODELS


def _top(model, text):
    probs = model.predict_proba([text])[0]
    ranked = sorted(((str(c), float(p)) for c, p in zip(model.classes_, probs)), key=lambda x: -x[1])
    return ranked


def predict(text: str) -> dict:
    m = _models()
    packs = _top(m["pack"], text)
    diff = _top(m["difficulty"], text)
    return {
        "pack": packs[0][0],
        "pack_confidence": round(float(packs[0][1]), 3),
        "pack_ranking": [(p, round(float(c), 3)) for p, c in packs],
        "difficulty": diff[0][0],
        "difficulty_confidence": round(float(diff[0][1]), 3),
        "trusted": bool(packs[0][1] >= cfg()["router"]["confidence_threshold"]),
    }


def main(argv=None):
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("train")
    p = sub.add_parser("predict")
    p.add_argument("text", nargs="+")
    a = ap.parse_args(argv)
    if a.cmd == "train":
        train()
    else:
        print(json.dumps(predict(" ".join(a.text)), indent=2))


if __name__ == "__main__":
    sys.exit(main())
