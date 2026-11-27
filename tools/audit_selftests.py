"""Find self-tests that fail on all 4 frozen candidates (0/4) and suites that crash.

  python3 tools/audit_selftests.py [--only ts-01,react] [--out FILE] [--sample N --min-react M --seed 0]

Rebuilds suites a/b from data/frozen/<id>/suite_*.raw.txt exactly as tdd.solve does, runs them on cand0..3
(run dirs audit<k>, removed afterwards) and writes one JSONL record per 0/4 test (and one per crashed suite).
"""
import argparse
import json
import random
import re
import shutil
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src import tdd  # noqa: E402
from src.eval import KIT, ext, load_tasks  # noqa: E402

FROZEN = ROOT / "data" / "frozen"
SCRATCH = Path("/tmp/claude-1000/-home-caleb-Documents-claude-code-projects-streamcoder/"
               "93da0ffe-0d7b-4d55-a613-68ce44c7d130/scratchpad")


def test_body(code: str, name: str) -> str:
    """Source of the test(...)/it(...) call whose title is the last part of `name` (best effort)."""
    parts = name.split(" > ")
    titles = {name, *(" > ".join(parts[i:]) for i in range(len(parts)))}
    for m in re.finditer(r"\b(?:test|it)(?:\.\w+)?\s*\(\s*([\"'`])", code):
        q = m.group(1)
        end = code.find(q, m.end())
        if end < 0 or code[m.end():end] not in titles:
            continue
        depth, i, in_str = 0, m.end() - 1, None
        i = code.find("(", m.start())
        while i < len(code):
            c = code[i]
            if in_str:
                if c == "\\":
                    i += 1
                elif c == in_str:
                    in_str = None
            elif c in "\"'`":
                in_str = c
            elif c == "(":
                depth += 1
            elif c == ")":
                depth -= 1
                if depth == 0:
                    return code[m.start():i + 1]
            i += 1
        return code[m.start():]
    return ""


def vitest_run(run: Path) -> dict:
    """{'pass': {key: bool}, 'msg': {key: full failure text}, 'crash': {suite: text}}"""
    out = run / "result.json"
    res = {"pass": {}, "msg": {}, "crash": {}}
    try:
        cp = tdd._run([str(KIT / "node_modules" / ".bin" / "vitest"), "run", f".runs/{run.name}",
                       "--reporter=json", f"--outputFile={out}"], tdd._timeout())
    except subprocess.TimeoutExpired:  # e.g. fake-timer deadlock: whole run hangs
        for s in tdd.SUITES:
            res["crash"][s] = "TIMEOUT: vitest run killed after %ss" % tdd._timeout()
        return res
    try:
        data = json.loads(out.read_text())
    except (OSError, ValueError):
        for s in tdd.SUITES:
            res["crash"][s] = ((cp.stderr or "") + (cp.stdout or ""))[-1500:] or "no result.json"
        return res
    seen = set()
    for f in data.get("testResults", []):
        m = re.search(r"selftest_(\w)\.test", f.get("name", ""))
        if not m:
            continue
        s = m.group(1)
        seen.add(s)
        for a in f.get("assertionResults", []):
            key = f"{s}::{' > '.join(a.get('ancestorTitles', []) + [a['title']])}"
            while key in res["pass"]:
                key += "'"
            res["pass"][key] = a.get("status") == "passed"
            res["msg"][key] = "\n".join(str(x) for x in a.get("failureMessages", []))
        if not f.get("assertionResults") and f.get("status") != "passed":
            res["crash"][s] = (f.get("message") or "")[:1500] or ((cp.stderr or "") + (cp.stdout or ""))[-1500:]
    return res


def audit(t, d: Path, cache: dict):
    type_only = tdd.is_type_only(t)
    suites = {s: tdd.parse_suite((d / f"suite_{s}.raw.txt").read_text(), type_only) for s in tdd.SUITES}
    live = {s: b for s, b in suites.items() if b}
    empty = [s for s in tdd.SUITES if not suites[s]]
    codes = [(d / f"cand{k}{ext(t)}").read_text() for k in range(4)]
    results, runs = [], []
    try:
        for k, c in enumerate(codes):
            run, meta = tdd.write_run(t, f"audit{k}", c, live, type_only)
            runs.append(run)
            if type_only:
                r = tdd.run_selftests(t, run, meta, type_only)
                results.append({"pass": {k2: v[0] for k2, v in r.items()}, "msg": {k2: v[1] for k2, v in r.items()},
                                "crash": {}})
            else:
                results.append(vitest_run(run))
    finally:
        for r in runs:
            shutil.rmtree(r, ignore_errors=True)
    keys = sorted(set().union(*[set(r["pass"]) for r in results]))
    zero = [k for k in keys if not any(r["pass"].get(k) for r in results)]
    crashed = sorted(set.intersection(*[set(r["crash"]) for r in results])) if not type_only else []
    return suites, results, keys, zero, crashed, empty


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="", help="comma-separated id prefixes")
    ap.add_argument("--out", default=str(SCRATCH / "zero_tests.jsonl"))
    ap.add_argument("--sample", type=int, default=0)
    ap.add_argument("--min-react", type=int, default=0)
    ap.add_argument("--seed", type=int, default=0)
    a = ap.parse_args()
    pre = tuple(p for p in a.only.split(",") if p)
    tasks = [t for t in load_tasks() if t["status"] == "ready" and (not pre or t["id"].startswith(pre))
             and (FROZEN / t["id"] / "meta.json").exists()]
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    recs = []
    stat = defaultdict(lambda: dict(tasks=0, tests=0, zero=0, crash=0, empty=0))
    for t in tasks:
        d = FROZEN / t["id"]
        suites, results, keys, zero, crashed, empty = audit(t, d, {})
        st = stat[t["topic"]]
        st["tasks"] += 1
        st["tests"] += len(keys)
        st["zero"] += len(zero)
        st["crash"] += len(crashed)
        st["empty"] += len(empty)
        base = dict(id=t["id"], topic=t["topic"])
        for k in zero:
            s, name = k.split("::", 1)
            ran = [r for r in results if k in r["msg"]]
            msg = (results[0]["msg"].get(k) or next((r["msg"][k] for r in ran if r["msg"][k]), ""))
            if not ran:
                msg = "(test did not run on any candidate)"
            elif k not in results[0]["msg"]:
                msg = "(cand0: test not reported) " + msg
            recs.append(dict(base, suite=s, test_name=name, test_code=test_body(suites.get(s, ""), name),
                             failure_message=msg[:1500], suite_crash_stderr=None))
        for s in crashed:
            recs.append(dict(base, suite=s, test_name=None, test_code=suites.get(s, "")[:6000],
                             failure_message="", suite_crash_stderr=results[0]["crash"][s][:1500]))
        print(f"{t['id']}: tests {len(keys)} zero {len(zero)} crashed {crashed} empty {empty}", flush=True)
    out.write_text("".join(json.dumps(r) + "\n" for r in recs))
    print(f"\n{'topic':12}{'tasks':>6}{'tests':>7}{'0/4':>6}{'crash':>7}{'no-suite':>9}")
    for tp, st in sorted(stat.items()):
        print(f"{tp:12}{st['tasks']:>6}{st['tests']:>7}{st['zero']:>6}{st['crash']:>7}{st['empty']:>9}")
    print(f"records -> {out} ({len(recs)})")
    if a.sample:
        rnd = random.Random(a.seed)
        react = [r for r in recs if r["topic"] == "react"]
        rest = [r for r in recs if r["topic"] != "react"]
        pick = rnd.sample(react, min(a.min_react, len(react)))
        left = [r for r in recs if r not in pick]
        pick += rnd.sample(left, min(max(a.sample - len(pick), 0), len(left)))
        sp = out.parent / "zero_sample.jsonl"
        sp.write_text("".join(json.dumps(r) + "\n" for r in pick))
        print(f"sample {len(pick)} -> {sp}")


if __name__ == "__main__":
    main()
