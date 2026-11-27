"""Offline picker comparison on the frozen candidates (NO LLM calls).

  python3 tools/pickers.py [--refresh] [--ids a,b] [--workers 1] [--report PATH] [--k K] [--frozen DIR]

Step A (per candidate, cached as JSON in the scratchpad under <frozen dir name>/<id>/cand<k>.json, so --k 4 and
--k 8 share work; --k K uses only cand0..K-1 in every picker and in the oracle): for each frozen candidate compute
  tests   {suite::test: passed}   self-tests of both frozen suites (current tdd.py harness)
  counts  {err, warn, unhandled}  console / unhandled-rejection counts from the self-test run
  tsc     number of `error TS` lines from compiling the candidate alone (same tsconfig as grading)
  missing required exports (src.eval.missing_exports)
  smoke   True if the module imports without throwing in vitest (React: jsdom). For React we also try to render
          every exported PascalCase function with no props inside an error boundary, but that is INFORMATION
          only (smoke_render_errors): components legitimately need props, so it would be a false negative.
  probes  {probe: {ok, value|error}} fingerprints from the frozen MBR-Exec drivers (tdd.run_probes)
Step B: pickers (each returns (index, top_tie)); common tie-break chain: fewer tsc errors, fewer console
  err+warn, fewer unhandled, lowest index. Step C: report per method and topic.
"""
import argparse
import json
import re
import shutil
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src import tdd  # noqa: E402
from src.eval import KIT, _run, _write_tsconfig, ext, load_tasks, missing_exports  # noqa: E402

FROZEN = ROOT / "data" / "frozen"
SCRATCH = Path("/tmp/claude-1000/-home-caleb-Documents-claude-code-projects-streamcoder/"
               "93da0ffe-0d7b-4d55-a613-68ce44c7d130/scratchpad")
CACHE = SCRATCH / "picker_cache"
LIVE_ORACLE = 0.38

# ------------------------------------------------------------------ step A: features


_smoke_file, _tsc_count, _smoke = tdd._smoke_file, tdd._tsc_count, tdd._smoke  # shared with src/tdd.py


def _hook_count(v) -> int:
    """meta.json stores {suite: n} (frozen8) or nothing (old freeze)."""
    return sum(v.values()) if isinstance(v, dict) else int(v or 0)


def _candidate(t, k: int, code: str, suites: dict, type_only: bool, drivers: str) -> dict:
    run, meta = tdd.write_run(t, f"pk{k}", code, suites, type_only)
    try:
        res = tdd.run_selftests(t, run, meta, type_only)
        counts = tdd.read_counts(run)
    finally:
        shutil.rmtree(run, ignore_errors=True)
    probes = tdd.run_probes(t, code, drivers, f"pk{k}probe") if drivers else {}
    return {"tests": {key: bool(v[0]) for key, v in res.items()}, "counts": counts,
            "tsc": _tsc_count(t, code, k), "missing": missing_exports(t, code),
            "smoke": _smoke(t, code, k), "probes": probes}


def features(t, refresh=False, k=None, frozen=FROZEN) -> dict:
    """Features for cand0..k-1 (k=None: all frozen candidates). Per-candidate cache; only missing ones are computed."""
    d = frozen / t["id"]
    meta = json.loads((d / "meta.json").read_text())
    n_have = len(meta["cand_hidden"])
    k = min(k or n_have, n_have)
    type_only = tdd.is_type_only(t)
    rd = lambda n: (d / n).read_text() if (d / n).exists() else ""  # noqa: E731
    hook = tdd.is_hook_task(t)
    suites = {s: tdd.parse_suite(rd(f"suite_{s}.raw.txt"), type_only, hook) for s in tdd.SUITES}
    drivers = rd("drivers.raw.txt")
    cdir = CACHE / frozen.name / t["id"]
    cdir.mkdir(parents=True, exist_ok=True)
    cands, todo = {}, []
    legacy = CACHE / f"{t['id']}.json"          # old per-task cache (4-cand data): migrate into per-candidate files
    if frozen.name == "frozen" and legacy.exists() and not refresh:
        old = json.loads(legacy.read_text())["cands"]
        for i, c in enumerate(old):
            if not (cdir / f"cand{i}.json").exists():
                (cdir / f"cand{i}.json").write_text(json.dumps(c))
    for i in range(k):
        f = cdir / f"cand{i}.json"
        if f.exists() and not refresh:
            cands[i] = json.loads(f.read_text())
        else:
            todo.append(i)

    def one(i):
        c = _candidate(t, i, rd(f"cand{i}{ext(t)}"), suites, type_only, drivers)
        (cdir / f"cand{i}.json").write_text(json.dumps(c))
        return i, c
    if todo:
        with ThreadPoolExecutor(min(len(todo), 4)) as ex:
            cands.update(dict(ex.map(one, todo)))
    return {"id": t["id"], "topic": t["topic"], "type_only": type_only, "hidden": meta["cand_hidden"][:k],
            "suites_ok": [bool(suites[s]) for s in tdd.SUITES],
            "hook_dropped": _hook_count(meta.get("hook_tests_dropped")), "cands": [cands[i] for i in range(k)]}


# ------------------------------------------------------------------ step B: pickers (pure)
# A candidate record is the dict from features()["cands"][i]. Every picker takes a list of records and returns
# (index into that list, top_tie) where top_tie = several candidates shared the top score.


def tiebreak_key(c: dict, i: int) -> tuple:
    n = c["counts"]
    return (c["tsc"], n["err"] + n["warn"], n["unhandled"], i)


def _best(scores: list, cands: list) -> tuple:
    top = max(scores)
    tied = [i for i, s in enumerate(scores) if s == top]
    return min(tied, key=lambda i: tiebreak_key(cands[i], i)), len(tied) > 1


ORDERS = {"A": "cand0-first", "B": "largest cluster, then lowest index",
          "C": "fewest tsc, console, unhandled, then index", "D": "largest cluster, then C"}


def _order_key(order: str, c: dict, i: int, cl: int) -> tuple:
    if order == "A":
        return (i,)
    if order == "B":
        return (-cl, i)
    if order == "C":
        return tiebreak_key(c, i)
    return (-cl,) + tiebreak_key(c, i)


def selftest_scores(cands: list) -> dict:
    """score = passes on tests that at least one of these candidates passes (non-0/N). cluster = how many of these
    candidates share this candidate's pass-vector (tie-breaker ONLY, never a multiplier)."""
    sc = tdd.score_tests([c["tests"] for c in cands])
    vec = [tuple(bool(c["tests"].get(k)) for k in sc["keys"]) for c in cands]
    return {"scores": sc["scores"], "keys": sc["keys"], "cluster": [vec.count(v) for v in vec]}


def pick_selftest(cands: list, order: str = "C") -> tuple:
    """Most self-test passes wins; ties by `order` (A/B/C/D, see ORDERS). Returns (index, top_tie)."""
    s = selftest_scores(cands)
    top = max(s["scores"])
    tied = [i for i, x in enumerate(s["scores"]) if x == top]
    return min(tied, key=lambda i: _order_key(order, cands[i], i, s["cluster"][i])), len(tied) > 1


def _fp(p: dict) -> tuple:
    return (bool(p.get("ok")), str(p.get("value") if p.get("ok") else p.get("error")))


def mbr_scores(cands: list) -> list:
    """(c) per probe, count OTHER candidates with the identical fingerprint. Score tuple =
    (has any ok probe, matches summed over probes where this candidate is ok, matches over its error probes).
    Candidates whose probes all errored (or that have none) get has_ok False and rank last."""
    fps = [{n: _fp(p) for n, p in c["probes"].items()} for c in cands]
    out = []
    for i, f in enumerate(fps):
        ok_m = err_m = 0
        for n, fp in f.items():
            m = sum(1 for j, g in enumerate(fps) if j != i and g.get(n) == fp)
            if fp[0]:
                ok_m += m
            else:
                err_m += m
        out.append((any(v[0] for v in f.values()), ok_m, err_m))
    return out


def pick_mbr(cands: list) -> tuple:
    return _best(mbr_scores(cands), cands)


filter_survivors = tdd.filter_survivors  # one implementation, shared with the live pipeline


def pick_filter(cands: list) -> tuple:
    s = filter_survivors(cands)
    return s[0], len(s) > 1


def with_filter(picker):
    def run(cands: list) -> tuple:
        s = filter_survivors(cands)
        i, tie = picker([cands[j] for j in s])
        return s[i], tie
    return run


METHODS = {
    "cand0": lambda cands: (0, False),
    "filter": pick_filter,
    "mbr (nofilter)": pick_mbr,
    "filter+mbr": with_filter(pick_mbr),
    "nofilter+selftest_C": lambda cands: pick_selftest(cands, "C"),   # reference only
    **{f"filter+selftest_{o}": with_filter(lambda cs, o=o: pick_selftest(cs, o)) for o in ORDERS},
}
LOSS_METHOD = "filter+selftest_C"

# ------------------------------------------------------------------ step C: report


TOPICS = ["all", "typescript", "react", "node"]


def _sel(feats, tp):
    return [f for f in feats if tp == "all" or f["topic"] == tp]


def report(feats: list) -> dict:
    rows = {}
    for name in list(METHODS) + ["oracle"]:
        row = {}
        for tp in TOPICS:
            fs = _sel(feats, tp)
            orc = [f for f in fs if any(f["hidden"])]
            passes = ties = cap = 0
            for f in fs:
                if name == "oracle":
                    passes += any(f["hidden"])
                    continue
                i, tie = METHODS[name](f["cands"])
                passes += bool(f["hidden"][i])
                cap += bool(f["hidden"][i]) and any(f["hidden"])
                ties += bool(tie)
            n = len(fs)
            row[tp] = {"n": n, "pass": passes, "pass_rate": passes / n if n else 0,
                       "oracle_tasks": len(orc), "capture": passes / len(orc) if orc else 0,
                       "pass_rate_over_0.38": (passes / n) / LIVE_ORACLE if n else 0,
                       "top_tie_rate": ties / n if n else 0}
        rows[name] = row
    return rows


def test_stats(feats: list) -> dict:
    """Zero = test fails on ALL K candidates (before the filter); N/N = passes on all K. Share by topic, plus hook drops."""
    out = {}
    for tp in TOPICS:
        tot = zero = nn = 0
        for f in _sel(feats, tp):
            oks = [c["tests"] for c in f["cands"]]
            keys = set().union(*[set(o) for o in oks]) if oks else set()
            for k in keys:
                p = sum(bool(o.get(k)) for o in oks)
                tot += 1
                zero += p == 0
                nn += p == len(oks)
        out[tp] = {"tests": tot, "zero": zero, "all_pass": nn,
                   "hook_tests_dropped": sum(f.get("hook_dropped", 0) for f in _sel(feats, tp))}
    for tp in TOPICS:
        o = out[tp]
        o["zero_rate"] = o["zero"] / o["tests"] if o["tests"] else 0
        o["nn_rate"] = o["all_pass"] / o["tests"] if o["tests"] else 0
        o["share_of_all_zero"] = o["zero"] / out["all"]["zero"] if out["all"]["zero"] else 0
        o["share_of_all_nn"] = o["all_pass"] / out["all"]["all_pass"] if out["all"]["all_pass"] else 0
    return out


def loss_analysis(feats: list, method: str = LOSS_METHOD) -> list:
    """Tasks where some candidate passes hidden but `method` picks a failing one, labelled
    tie-break / outscored / filtered (self-test scores computed among the filter survivors)."""
    out = []
    for f in feats:
        if not any(f["hidden"]):
            continue
        i, _ = METHODS[method](f["cands"])
        if f["hidden"][i]:
            continue
        cs = f["cands"]
        surv = filter_survivors(cs) if method.startswith("filter") else list(range(len(cs)))
        good = [j for j in surv if f["hidden"][j]]
        rec = {"id": f["id"], "topic": f["topic"], "picked": i,
               "good": [j for j, h in enumerate(f["hidden"]) if h]}
        if not good:
            rec["label"] = "filtered"
        else:
            s = selftest_scores([cs[j] for j in surv])
            sc = dict(zip(surv, s["scores"]))
            gbest = max(good, key=lambda j: sc[j])
            rec.update(picked_score=sc[i], good_score=sc[gbest])
            if sc[gbest] == sc[i]:
                rec["label"] = "tie-break"
            else:
                rec["label"] = "outscored"
                rec["picked_passed_good_failed"] = [k for k in s["keys"] if cs[i]["tests"].get(k)
                                                    and not cs[gbest]["tests"].get(k)]
                rec["good_passed_picked_failed"] = [k for k in s["keys"] if cs[gbest]["tests"].get(k)
                                                    and not cs[i]["tests"].get(k)]
        out.append(rec)
    return out


def markdown(rows: dict, ts: dict, loss: list, k: int) -> str:
    ln = [f"### K={k}: pick pass / capture (picked passes / oracle tasks), per topic",
          "| method | all | capture | tie | typescript | react | node |", "|---|---|---|---|---|---|---|"]
    for name, r in rows.items():
        a = r["all"]
        by = " | ".join(f"{r[tp]['pass']}/{r[tp]['n']} ({r[tp]['pass_rate']:.0%}; cap {r[tp]['capture']:.0%} of {r[tp]['oracle_tasks']})"
                        for tp in TOPICS[1:])
        ln.append(f"| {name} | {a['pass']}/{a['n']} = {a['pass_rate']:.0%} | {a['pass']}/{a['oracle_tasks']} = {a['capture']:.0%} "
                  f"| {a['top_tie_rate']:.0%} | {by} |")
    ln += ["", "### Self-test zero / N-of-N / hook drops", "| topic | tests | zero (0/K) | zero share | zero rate | N/N | N/N share | N/N rate | hook dropped |",
           "|---|---|---|---|---|---|---|---|---|"]
    for tp in TOPICS:
        o = ts[tp]
        ln.append(f"| {tp} | {o['tests']} | {o['zero']} | {o['share_of_all_zero']:.0%} | {o['zero_rate']:.0%} | {o['all_pass']} "
                  f"| {o['share_of_all_nn']:.0%} | {o['nn_rate']:.0%} | {o['hook_tests_dropped']} |")
    ln += ["", f"### Loss analysis ({LOSS_METHOD}): oracle true, pick fails"]
    for tp in TOPICS[1:]:
        ls = [x for x in loss if x["topic"] == tp]
        ln.append(f"- {tp}: {len(ls)} lost " + ", ".join(f"{x['label']}" for x in ls))
        for x in ls:
            d = f"  - {x['id']} [{x['label']}] picked cand{x['picked']}, hidden-passing {x['good']}"
            if x["label"] == "outscored":
                d += f", scores {x['picked_score']} vs {x['good_score']}"
                if tp == "node":
                    d += f"; picked passed/good failed: {x['picked_passed_good_failed']}; good passed/picked failed: {x['good_passed_picked_failed']}"
            ln.append(d)
    return "\n".join(ln)


def oddities(feats: list) -> list:
    out = []
    no_probe = [f["id"] for f in feats if all(not c["probes"] for c in f["cands"])]
    all_err = [f["id"] for f in feats if any(c["probes"] for c in f["cands"])
               and all(not any(p.get("ok") for p in c["probes"].values()) for c in f["cands"])]
    smoke_fail_good = [(f["id"], k) for f in feats for k, c in enumerate(f["cands"])
                       if f["hidden"][k] and not c["smoke"]["ok"]]
    filt_fail_good = [(f["id"], k) for f in feats for k, c in enumerate(f["cands"])
                      if f["hidden"][k] and (c["tsc"] or c["missing"])]
    render_err = sum(1 for f in feats if f["topic"] == "react" for c in f["cands"] if c["smoke"]["render_errors"])
    out.append(f"tasks with no probe output for any candidate: {len(no_probe)} {no_probe[:6]}")
    out.append(f"tasks where every probe errors for every candidate: {len(all_err)} {all_err[:6]}")
    out.append(f"smoke false negatives (hidden-pass but smoke failed): {len(smoke_fail_good)} {smoke_fail_good[:6]}")
    out.append(f"hidden-pass candidates dropped by tsc/missing-export filter: {len(filt_fail_good)} {filt_fail_good[:6]}")
    out.append(f"react candidates with a no-props render error (info only): {render_err}")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true")
    ap.add_argument("--ids", default="")
    ap.add_argument("--workers", type=int, default=1, help="tasks processed in parallel (each runs up to 4 candidates at once)")
    ap.add_argument("--report", default=str(SCRATCH / "picker_report.json"))
    ap.add_argument("--k", type=int, default=0, help="use only cand0..K-1 (default: all present)")
    ap.add_argument("--frozen", default=str(FROZEN))
    a = ap.parse_args()
    frozen = Path(a.frozen)
    if not frozen.is_absolute():
        frozen = ROOT / frozen
    want = {i for i in a.ids.split(",") if i}
    tasks = [t for t in load_tasks() if (frozen / t["id"] / "meta.json").exists() and (not want or t["id"] in want)]
    t0 = time.time()

    def one(t):
        f = features(t, a.refresh, a.k or None, frozen)
        print(f"  {t['id']} done ({time.time() - t0:.0f}s)", file=sys.stderr, flush=True)
        return f
    with ThreadPoolExecutor(a.workers) as ex:
        feats = list(ex.map(one, tasks))
    k = min(len(f["cands"]) for f in feats) if feats else 0
    rows, ts, loss, odd = report(feats), test_stats(feats), loss_analysis(feats), oddities(feats)
    if a.report == str(SCRATCH / "picker_report.json"):
        a.report = str(SCRATCH / f"picker_report_{frozen.name}_k{k}.json")
    Path(a.report).parent.mkdir(parents=True, exist_ok=True)
    Path(a.report).write_text(json.dumps({"n_tasks": len(feats), "k": k, "methods": rows, "test_stats": ts,
                                          "loss_method": LOSS_METHOD, "losses": loss, "oddities": odd}, indent=1))
    print(markdown(rows, ts, loss, k))
    print("\n".join(odd))


if __name__ == "__main__":
    main()
