"""Freeze candidate data once so picker methods can be compared offline.

  python3 tools/freeze.py [--only ts-01,react-14] [--model 7b] [--n-cand 4] [--out data/frozen]

Per ready task writes <out>/<id>/: cand0..N-1.ts(x) + cand*.raw.txt, suite_a/b.raw.txt, drivers.raw.txt,
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


cand_plan = tdd.cand_plan  # shared with the live pipeline (src/tdd.py)


def _chat(model, msgs, max_tokens, temperature, seed=None) -> dict:
    try:
        return llm.chat(model, msgs, max_tokens=max_tokens, temperature=temperature, seed=seed)
    except Exception as e:
        return {"text": "", "seconds": 0, "completion_tokens": 0, "error": str(e)[:100]}


def freeze(t, model: str, n_cand: int = 4, out: Path = OUT, fast_gen: bool = False) -> dict:
    d = out / t["id"]
    temps, seeds = cand_plan(n_cand)
    d.mkdir(parents=True, exist_ok=True)
    type_only = tdd.is_type_only(t)
    base = tdd.cand_messages(t, fast_gen)   # fast_gen=False: byte-identical to SYSTEM + build_prompt
    t0 = time.time()
    with ThreadPoolExecutor(n_cand + 3) as ex:
        cf = [ex.submit(tdd.gen_candidate, model, t, base, temps[k], seeds[k], fast_gen) for k in range(n_cand)]
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
    hook = tdd.is_hook_task(t)
    dropped = {s: tdd.parse_suite_n(o["text"], type_only, hook)[1] for s, o in suites.items()}
    hidden = [run_tests_cat(t, c) for c in codes]   # diagnostic only
    meta = {"id": t["id"], "topic": t["topic"], "cand_hidden": [bool(h[0]) for h in hidden],
            "cand_hidden_err": [(h[1] or "")[:100] if not h[0] else "" for h in hidden],
            "cand_tokens": [o.get("completion_tokens") or 0 for o in outs], "gen_seconds": gen,
            "type_only": type_only, "fast_gen": fast_gen, "n_capped": sum(bool(o.get("capped")) for o in outs), "n_cand": n_cand, "hook_tests_dropped": dropped,
            "errors": [o["error"] for o in [*outs, *suites.values(), drv] if o.get("error")]}
    (d / "meta.json").write_text(json.dumps(meta, indent=1))
    return meta


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="", help="comma-separated id prefixes")
    ap.add_argument("--model", default="7b")
    ap.add_argument("--n-cand", type=int, default=4)
    ap.add_argument("--fast-gen", action="store_true", help="candidates: fence prefill + stop + 1536 cap + 'No JSDoc comments.'")
    ap.add_argument("--out", default=str(OUT))
    a = ap.parse_args()
    out = Path(a.out)
    if not out.is_absolute():
        out = ROOT / out
    pre = tuple(p for p in a.only.split(",") if p)
    tasks = [t for t in load_tasks() if t["status"] == "ready" and (not pre or t["id"].startswith(pre))]
    for i, t in enumerate(tasks, 1):
        if (out / t["id"] / "meta.json").exists():
            print(f"[{i}/{len(tasks)}] {t['id']}: already frozen, skipped")
            continue
        m = freeze(t, a.model, a.n_cand, out, a.fast_gen)
        print(f"[{i}/{len(tasks)}] {t['id']}: gen {m['gen_seconds']}s hidden {''.join('P' if h else '-' for h in m['cand_hidden'])}"
              f" tokens {m['cand_tokens']}" + (f" ERRORS {m['errors']}" if m["errors"] else ""), flush=True)


if __name__ == "__main__":
    main()
