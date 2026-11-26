"""Scoreboard: runs TypeScript / React / Node tasks and grades answers with real tests.

Each task in data/eval/tasks.jsonl has a prompt, requirements ("criteria") and a status.
Tasks with status "ready" have a folder in data/eval/tasks/<id>/ containing:
  reference.ts(x)        a known-good solution (proves the tests are passable)
  solution.test.ts(x)    hidden tests (vitest). They import from "./solution".

Grading an answer = strict type check (tsc, strict mode) + hidden tests (vitest).
The model sees the prompt and requirements, never the tests or the reference.

Usage:
  python -m src.eval --reference                      # sanity check: references must pass
  python -m src.eval --model 7b --label baseline       # plain model
  python -m src.eval --model 7b --stream --label "..."  # model + router + library
  python -m src.eval --list                           # show task status counts
Needs: cd evalkit && npm install   (once)
"""
import argparse
import json
import re
import shutil
import os
import signal
import subprocess
import sys
import time
from collections import Counter
from pathlib import Path

from .config import cfg, path

TASKS = "data/eval/tasks.jsonl"
KIT = path("evalkit")

SYSTEM = ("You are a careful TypeScript engineer. Answer with ONE fenced code block containing the "
          "complete module. Use named exports exactly as requested, strict TypeScript, no `any` "
          "unless the signature requires it, and no extra dependencies beyond React and Node built-ins.")


def load_tasks():
    return [json.loads(l) for l in path(TASKS).read_text().splitlines() if l.strip()]


def task_dir(t) -> Path:
    return path(f"data/eval/tasks/{t['id']}")


def ext(t) -> str:
    return ".tsx" if t["topic"] == "react" else ".ts"


def build_prompt(t) -> str:
    parts = [t["prompt"]]
    if t.get("must_export"):
        parts.append(f"Must export: {t['must_export']}")
    if t.get("example"):
        parts.append(f"Example:\n```ts\n{t['example']}\n```")
    if t.get("broken_code"):
        parts.append(f"Here is the current broken code:\n```ts\n{t['broken_code']}\n```")
    parts.append("Requirements:\n" + "\n".join(f"- {c}" for c in t["criteria"]))
    lang = "tsx" if t["topic"] == "react" else "ts"
    parts.append(f"Reply with the full module in one ```{lang} code block.")
    return "\n\n".join(parts)


def extract_code(text: str) -> str:
    blocks = re.findall(r"```(?:tsx?|typescript|jsx?|javascript)?[^\n]*\n(.*?)```", text, re.S)
    return max(blocks, key=len) if blocks else text


def _tail(s: str, n=3) -> str:
    lines = [l for l in s.strip().splitlines() if l.strip()]
    return " | ".join(lines[-n:])[:300]


def _run(cmd, timeout):
    """subprocess.run, but on timeout kill the whole process group: vitest's worker
    processes would otherwise keep spinning on an infinite loop after the parent dies."""
    p = subprocess.Popen(cmd, cwd=KIT, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                         text=True, start_new_session=True)
    try:
        out, err = p.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        os.killpg(p.pid, signal.SIGKILL)
        p.communicate()
        raise
    return subprocess.CompletedProcess(cmd, p.returncode, out, err)


_MISSING_TSC = re.compile(r"TS(2305|2614|2307)\b.*solution|solution.*TS(2305|2614|2307)\b|"
                          r"has no exported member|Cannot find module '\./solution'")
_MISSING_RUNTIME = re.compile(r"is not a function|is not a constructor|Element type is invalid|"
                              r"does not provide an export named|is not a module|is not iterable")


def categorize(passed: bool, error: str) -> str | None:
    """Failure category from the (full) error text: missing-export, type-error, test-fail, timeout."""
    if passed:
        return None
    if error == "timeout":
        return "timeout"
    if error.startswith("type error"):
        return "missing-export" if _MISSING_TSC.search(error) else "type-error"
    if _MISSING_RUNTIME.search(error):
        return "missing-export"
    return "test-fail"


def run_tests(t, code: str):
    """Returns (passed, short_error)."""
    return run_tests_cat(t, code)[:2]


def run_tests_cat(t, code: str):
    """Returns (passed, short_error, category); category is classified from the full output."""
    run = KIT / ".runs" / t["id"]
    if run.exists():
        shutil.rmtree(run)
    run.mkdir(parents=True)
    (run / f"solution{ext(t)}").write_text(code)
    for f in task_dir(t).glob("solution.test.*"):
        shutil.copy(f, run / f.name)
    tsconfig = {"extends": "../../tsconfig.base.json", "include": ["./*.ts", "./*.tsx"]}
    if t["topic"] == "react":
        # Browser code: setTimeout returns number (DOM), not NodeJS.Timeout. The shim keeps
        # code that annotates timers as NodeJS.Timeout compiling too, so both idioms pass.
        tsconfig["compilerOptions"] = {"types": []}
        (run / "node-shim.d.ts").write_text("declare namespace NodeJS { type Timeout = number; }\n")
    (run / "tsconfig.json").write_text(json.dumps(tsconfig))
    bin_ = KIT / "node_modules" / ".bin"
    timeout = cfg()["eval"]["timeout_seconds"]
    try:
        tsc = _run([str(bin_ / "tsc"), "-p", str(run / "tsconfig.json")], timeout * 6)
        if tsc.returncode != 0:
            return False, "type error: " + _tail(tsc.stdout, 2), categorize(False, "type error: " + tsc.stdout)
        vt = _run([str(bin_ / "vitest"), "run", f".runs/{t['id']}"], timeout * 6)
        if vt.returncode != 0:
            fails = re.findall(r"FAIL .*?> (.+)", vt.stdout + vt.stderr)
            full = vt.stdout + vt.stderr
            return (False, "test failed: " + ("; ".join(fails[:2]) or _tail(full)),
                    categorize(False, "test failed: " + full))
        return True, "", None
    except subprocess.TimeoutExpired:
        return False, "timeout", "timeout"


def vram_used_mb():
    """VRAM in use on AMD cards (Linux sysfs). Biggest card's number, or None."""
    vals = []
    for f in Path("/sys/class/drm").glob("card*/device/mem_info_vram_used"):
        try:
            vals.append(int(f.read_text()) // 2**20)
        except (OSError, ValueError):
            pass
    return max(vals) if vals else None


def _git_commit():
    try:
        return subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=path("."),
                              capture_output=True, text=True).stdout.strip() or None
    except OSError:
        return None


def record_run(a, results, detail_file):
    """Append one summary row to stats/runs.jsonl (tracked in git: the project's history)."""
    n = len(results)
    rate = lambda rs: round(sum(r["passed"] for r in rs) / len(rs), 3) if rs else None  # noqa: E731
    tps = [r["tokens_per_sec"] for r in results if r.get("tokens_per_sec")]
    vram = [r["vram_mb"] for r in results if r.get("vram_mb")]
    row = {
        "date": time.strftime("%Y-%m-%d %H:%M"), "label": a.label, "model": a.model,
        "model_file": a.model_file, "mode": "stream" if a.stream else "plain", "tasks": n,
        "pass_rate": rate(results),
        "easy": rate([r for r in results if r["difficulty"] == "easy"]),
        "hard": rate([r for r in results if r["difficulty"] == "hard"]),
        **{t: rate([r for r in results if r["topic"] == t]) for t in ("typescript", "react", "node")},
        "avg_seconds": round(sum(r["seconds"] for r in results) / n, 2),
        "tokens_per_sec": round(sum(tps) / len(tps), 1) if tps else None,
        "peak_vram_mb": max(vram) if vram else None,
        "fail_categories": dict(Counter(r["category"] for r in results if r.get("category"))),
        "commit": _git_commit(), "details": f"results/{detail_file}",
    }
    out = path("stats/runs.jsonl")
    out.parent.mkdir(exist_ok=True)
    with out.open("a") as f:
        f.write(json.dumps(row) + "\n")
    print("  logged to stats/runs.jsonl. Update the sheet: python tools/stats.py")


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--reference", action="store_true", help="grade the reference solutions")
    ap.add_argument("--list", action="store_true", help="show task counts by status")
    ap.add_argument("--model", default="7b")
    ap.add_argument("--stream", action="store_true", help="use router + library")
    ap.add_argument("--only", help="comma-separated task ids (prefix match)")
    ap.add_argument("--topic", choices=["typescript", "react", "node"])
    ap.add_argument("--label", help="what changed, e.g. 'baseline' (goes on the stat sheet)")
    ap.add_argument("--model-file", default="", help="GGUF file name, e.g. coder-7b-q4_k_m.gguf")
    a = ap.parse_args(argv)

    all_tasks = load_tasks()
    if a.list:
        print(Counter((t["topic"], t["status"]) for t in all_tasks))
        return
    if not (KIT / "node_modules").exists():
        sys.exit("Run once first:  cd evalkit && npm install")
    if not a.reference and not a.label:
        ap.error("--label is required so every run lands on the stat sheet (use 'baseline' first)")

    tasks = [t for t in all_tasks if t["status"] == "ready"]
    if a.topic:
        tasks = [t for t in tasks if t["topic"] == a.topic]
    if a.only:
        keys = a.only.split(",")
        tasks = [t for t in tasks if any(t["id"].startswith(k) for k in keys)]
    print(f"{len(tasks)} ready tasks ({sum(t['status'] != 'ready' for t in all_tasks)} still todo)\n")

    results = []
    for t in tasks:
        info = {}
        if a.reference:
            ref = next(task_dir(t).glob("reference.*"))
            code = ref.read_text()
        else:
            from . import llm, pipeline
            prompt = build_prompt(t)
            if a.stream:
                msgs, route, _ = pipeline.build_messages(prompt, system=SYSTEM)
                info["route"] = route["pack"]
            else:
                msgs = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": prompt}]
            out = llm.chat(a.model, msgs, max_tokens=2048, temperature=0)  # greedy: repeatable runs
            info.update(seconds=out["seconds"], tokens_per_sec=out["tokens_per_sec"], vram_mb=vram_used_mb())
            code = extract_code(out["text"])
        ok, err, cat = run_tests_cat(t, code)
        results.append(dict(id=t["id"], topic=t["topic"], difficulty=t["difficulty"], passed=ok, error=err,
                            category=cat, **info))
        print(f"{'PASS' if ok else 'FAIL'}  {t['id']:<46} {err}")

    n = len(results)
    if not n:
        return
    passed = sum(r["passed"] for r in results)
    print(f"\n{passed}/{n} passed ({passed / n:.0%})")
    for key in ("easy", "hard", "typescript", "react", "node"):
        sub = [r for r in results if key in (r["difficulty"], r["topic"])]
        if sub:
            print(f"  {key:<10} {sum(r['passed'] for r in sub)}/{len(sub)}")
    cats = Counter(r["category"] for r in results if r["category"])
    if cats:
        print("  failures: " + ", ".join(f"{k} {v}" for k, v in sorted(cats.items())))
    if not a.reference:
        print(f"  avg time: {sum(r['seconds'] for r in results) / n:.1f}s")
        out_dir = path("results")
        out_dir.mkdir(exist_ok=True)
        name = f"{time.strftime('%Y%m%d-%H%M')}_{a.model}{'_stream' if a.stream else ''}.jsonl"
        (out_dir / name).write_text("\n".join(json.dumps(r) for r in results))
        print(f"  saved results/{name}")
        record_run(a, results, name)
    elif passed != n:
        sys.exit(1)


if __name__ == "__main__":
    sys.exit(main())
