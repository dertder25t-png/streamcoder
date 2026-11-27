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


def _smoke_file(t) -> str:
    react = t["topic"] == "react"
    head = ["// @vitest-environment jsdom"] if react else []
    head.append('import { test } from "vitest";')
    head.append('import { writeFileSync as __wf } from "node:fs";')
    if react:
        head += ['import React from "react";', 'import { render, cleanup } from "@testing-library/react";']
        boundary = """
class EB extends React.Component<{ children?: any }, { e: boolean }> {
  state = { e: false };
  static getDerivedStateFromError() { return { e: true }; }
  componentDidCatch() {}
  render() { return this.state.e ? null : (this.props as any).children; }
}
"""
    else:
        boundary = ""
    body = """
const OUT = (globalThis as any).__SMOKE_OUT__;
test("smoke", async () => {
  const res: any = { import_ok: false, render_errors: [] };
  const origErr = console.error; console.error = () => {};
  try {
    const m: any = await import("./solution");
    res.import_ok = true;
    %s
  } catch (e: any) { res.import_error = String((e && e.message) || e).slice(0, 200); }
  console.error = origErr;
  __wf(OUT, JSON.stringify(res));
}, 20000);
"""
    render = ""
    if react:
        render = """for (const [k, v] of Object.entries(m)) {
      if (!/^[A-Z]/.test(k) || typeof v !== "function") continue;
      try { const C: any = v; render(<EB><C /></EB>); cleanup(); }
      catch (e: any) { res.render_errors.push(k); try { cleanup(); } catch {} }
    }"""
    return "\n".join(head) + "\n" + boundary + body.replace("(globalThis as any).__SMOKE_OUT__", "OUTPATH") % render


def _tsc_count(t, code: str, k: int) -> int:
    run = KIT / ".runs" / f"tdd--{t['id']}--pk{k}tsc"   # "tdd--" prefix: hidden grading's `.runs/<id>` filter ignores it
    shutil.rmtree(run, ignore_errors=True)
    run.mkdir(parents=True)
    try:
        (run / f"solution{ext(t)}").write_text(code)
        _write_tsconfig(t, run)
        out = _run([str(KIT / "node_modules" / ".bin" / "tsc"), "-p", str(run / "tsconfig.json")], tdd._timeout())
        return len(re.findall(r"error TS\d+", out.stdout))
    except Exception:
        return 0
    finally:
        shutil.rmtree(run, ignore_errors=True)


def _smoke(t, code: str, k: int) -> dict:
    run = tdd._run_dir(t, f"pk{k}smoke")
    try:
        (run / f"solution{ext(t)}").write_text(code)
        out = run / "smoke.json"
        src = _smoke_file(t).replace("OUTPATH", json.dumps(str(out)))
        (run / f"smoke.test{ext(t)}").write_text(src)
        _write_tsconfig(t, run)
        _run([str(KIT / "node_modules" / ".bin" / "vitest"), "run", f".runs/{run.name}", "--reporter=json",
              f"--outputFile={run / 'result.json'}"], tdd._timeout())
        d = json.loads(out.read_text())
        return {"ok": bool(d.get("import_ok")), "error": d.get("import_error", ""),
                "render_errors": d.get("render_errors", [])}
    except Exception as e:  # smoke file never wrote its result (crash/timeout at import) => failed
        return {"ok": False, "error": f"no result: {type(e).__name__}", "render_errors": []}
    finally:
        shutil.rmtree(run, ignore_errors=True)


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
            "suites_ok": [bool(suites[s]) for s in tdd.SUITES], "cands": [cands[i] for i in range(k)]}


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


def pick_selftest(cands: list) -> tuple:
    """(a) most passes on tests that at least one candidate passes (non-0/N), as tdd.py does."""
    sc = tdd.score_tests([c["tests"] for c in cands])
    return _best(sc["scores"], cands)


def codet_scores(cands: list) -> list:
    """(b) cluster by identical pass-vector on the non-0/N tests; score = cluster size x tests passed."""
    sc = tdd.score_tests([c["tests"] for c in cands])
    vec = [tuple(bool(c["tests"].get(k)) for k in sc["keys"]) for c in cands]
    return [vec.count(v) * sum(v) for v in vec]


def pick_codet(cands: list) -> tuple:
    return _best(codet_scores(cands), cands)


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


def filter_survivors(cands: list) -> list:
    """(d) zero-LLM filter: drop candidates with tsc errors, missing exports or a failed smoke import.
    If none survive, keep all."""
    ok = [i for i, c in enumerate(cands) if c["tsc"] == 0 and not c["missing"] and c["smoke"]["ok"]]
    return ok or list(range(len(cands)))


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
    "selftest": pick_selftest,
    "codet": pick_codet,
    "mbr": pick_mbr,
    "filter": pick_filter,
    "filter+selftest": with_filter(pick_selftest),
    "filter+codet": with_filter(pick_codet),
    "filter+mbr": with_filter(pick_mbr),
}

# ------------------------------------------------------------------ step C: report


def report(feats: list) -> dict:
    topics = ["all", "typescript", "react", "node"]
    rows = {}
    for name in list(METHODS) + ["oracle"]:
        row = {}
        for tp in topics:
            fs = [f for f in feats if tp == "all" or f["topic"] == tp]
            orc = [f for f in fs if any(f["hidden"])]
            passes = ties = 0
            for f in fs:
                if name == "oracle":
                    passes += any(f["hidden"])
                    continue
                i, tie = METHODS[name](f["cands"])
                passes += bool(f["hidden"][i])
                ties += bool(tie)
            n = len(fs)
            row[tp] = {"n": n, "pass": passes, "pass_rate": passes / n if n else 0,
                       "oracle_tasks": len(orc),
                       "acc_vs_frozen_oracle": passes / len(orc) if orc else 0,
                       "pass_rate_over_0.38": (passes / n) / LIVE_ORACLE if n else 0,
                       "top_tie_rate": ties / n if n else 0}
        rows[name] = row
    return rows


def markdown(rows: dict) -> str:
    topics = ["all", "typescript", "react", "node"]
    ln = ["| method | pass (all) | acc vs frozen oracle | rate/0.38 | tie rate | ts | react | node |",
          "|---|---|---|---|---|---|---|---|"]
    for name, r in rows.items():
        a = r["all"]
        by = " | ".join(f"{r[tp]['pass']}/{r[tp]['n']} ({r[tp]['acc_vs_frozen_oracle']:.0%})" for tp in topics[1:])
        ln.append(f"| {name} | {a['pass']}/{a['n']} = {a['pass_rate']:.0%} | {a['acc_vs_frozen_oracle']:.0%} "
                  f"({a['pass']}/{a['oracle_tasks']}) | {a['pass_rate_over_0.38']:.2f} | "
                  f"{a['top_tie_rate']:.0%} | {by} |")
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
    rows = report(feats)
    odd = oddities(feats)
    Path(a.report).parent.mkdir(parents=True, exist_ok=True)
    Path(a.report).write_text(json.dumps({"n_tasks": len(feats), "methods": rows, "oddities": odd}, indent=1))
    print(markdown(rows))
    print("\n".join(odd))


if __name__ == "__main__":
    main()
