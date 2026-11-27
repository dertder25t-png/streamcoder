"""Freeze candidate data once so picker methods can be compared offline.

  python3 tools/freeze.py [--only ts-01,react-14] [--model 7b]

Per ready task writes data/frozen/<id>/: cand0..3.ts(x) + cand*.raw.txt, suite_a/b.raw.txt, drivers.raw.txt,
meta.json (written last, so a task with meta.json is done and is skipped on re-runs). Hidden-test results in
meta.json are diagnostics only and are never shown to a model. Run tasks one at a time (the hidden grader
shares one folder per task); the 7 model requests of a task go out in parallel.
"""
import argparse
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src import llm, tdd  # noqa: E402
from src.eval import SYSTEM, build_prompt, ext, extract_code, load_tasks, run_tests_cat  # noqa: E402

OUT = ROOT / "data" / "frozen"
CAND_TEMPS, CAND_SEEDS = [0, 0.7, 0.7, 0.7], [None, 1, 2, 3]


def _chat(model, msgs, max_tokens, temperature, seed=None) -> dict:
    try:
        return llm.chat(model, msgs, max_tokens=max_tokens, temperature=temperature, seed=seed)
    except Exception as e:
        return {"text": "", "seconds": 0, "completion_tokens": 0, "error": str(e)[:100]}


def freeze(t, model: str) -> dict:
    d = OUT / t["id"]
    d.mkdir(parents=True, exist_ok=True)
    type_only = tdd.is_type_only(t)
    base = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": build_prompt(t)}]
    t0 = time.time()
    with ThreadPoolExecutor(7) as ex:
        cf = [ex.submit(_chat, model, base, 2048, CAND_TEMPS[k], CAND_SEEDS[k]) for k in range(4)]
        sf = {s: ex.submit(_chat, model, tdd.suite_messages(t, s, type_only), 1536, 0) for s in tdd.SUITES}
        df = ex.submit(_chat, model, tdd.driver_messages(t), 1536, 0)
        outs, suites, drv = [f.result() for f in cf], {s: f.result() for s, f in sf.items()}, df.result()
    gen = round(time.time() - t0, 1)
    codes = [extract_code(o["text"]) for o in outs]
    for k, (o, c) in enumerate(zip(outs, codes)):
        (d / f"cand{k}.raw.txt").write_text(o["text"])
        (d / f"cand{k}{ext(t)}").write_text(c)
    for s, o in suites.items():
        (d / f"suite_{s}.raw.txt").write_text(o["text"])
    (d / "drivers.raw.txt").write_text(drv["text"])
    hidden = [run_tests_cat(t, c) for c in codes]   # diagnostic only
    meta = {"id": t["id"], "topic": t["topic"], "cand_hidden": [bool(h[0]) for h in hidden],
            "cand_hidden_err": [(h[1] or "")[:100] if not h[0] else "" for h in hidden],
            "cand_tokens": [o.get("completion_tokens") or 0 for o in outs], "gen_seconds": gen,
            "type_only": type_only,
            "errors": [o["error"] for o in [*outs, *suites.values(), drv] if o.get("error")]}
    (d / "meta.json").write_text(json.dumps(meta, indent=1))
    return meta


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="", help="comma-separated id prefixes")
    ap.add_argument("--model", default="7b")
    a = ap.parse_args()
    pre = tuple(p for p in a.only.split(",") if p)
    tasks = [t for t in load_tasks() if t["status"] == "ready" and (not pre or t["id"].startswith(pre))]
    for i, t in enumerate(tasks, 1):
        if (OUT / t["id"] / "meta.json").exists():
            print(f"[{i}/{len(tasks)}] {t['id']}: already frozen, skipped")
            continue
        m = freeze(t, a.model)
        print(f"[{i}/{len(tasks)}] {t['id']}: gen {m['gen_seconds']}s hidden {''.join('P' if h else '-' for h in m['cand_hidden'])}"
              f" tokens {m['cand_tokens']}" + (f" ERRORS {m['errors']}" if m["errors"] else ""), flush=True)


if __name__ == "__main__":
    main()
