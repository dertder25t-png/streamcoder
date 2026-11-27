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
    if cfg()["eval"].get("format_rules", False):
        # Repeated at the very end so it comes AFTER any reference recipes (stream mode).
        parts.append("Output rules (follow exactly):\n"
                     f"- One ```{lang} code block containing the complete module, nothing else needed.\n"
                     "- Use `export` on every name the task asks for (named exports, no `export default`).\n"
                     "- Strict TypeScript: no implicit `any`, narrow `unknown` before use.\n"
                     "- Only React and Node built-ins (`node:` modules); no other packages.")
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


# Only errors in the TEST file's import of "./solution" mean the expected export is missing.
# Bad imports inside the solution itself (e.g. 'node:crypto' member, missing npm package) are type errors.
_MISSING_TSC = re.compile(r"solution\.test\.tsx?\(\d+,\d+\): error TS(2305|2306|2307|2614|2724)\b")
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


def _short_with_cause(prefix: str, short: str, full: str):
    """(False, saved_error, category). If the category comes from a line the short tail
    dropped, put that line first, so categorize(saved_error) always equals the live category."""
    cat = categorize(False, prefix + full)
    if categorize(False, prefix + short) != cat:
        pat = _MISSING_TSC if prefix.startswith("type") else _MISSING_RUNTIME
        line = next((l.strip() for l in full.splitlines() if pat.search(l)), "")
        short = f"{line} | {short}" if line else short
    return False, prefix + short, cat


def _write_tsconfig(t, run: Path):
    tsconfig = {"extends": "../../tsconfig.base.json", "include": ["./*.ts", "./*.tsx"]}
    if t["topic"] == "react":
        # Browser code: setTimeout returns number (DOM), not NodeJS.Timeout. The shim keeps
        # code that annotates timers as NodeJS.Timeout compiling too, so both idioms pass.
        tsconfig["compilerOptions"] = {"types": []}
        (run / "node-shim.d.ts").write_text("declare namespace NodeJS { type Timeout = number; }\n")
    (run / "tsconfig.json").write_text(json.dumps(tsconfig))


_ID = r"[A-Za-z_$][\w$]*"

def _strip_brackets(s: str) -> str:
    out, depth = [], 0
    for ch in s:
        if ch in "([{<": depth += 1
        elif ch in ")]}>" and depth: depth -= 1; continue
        if depth == 0: out.append(ch)
    return "".join(out)

def required_exports(t) -> list[str]:
    """Names the PROMPT says to export (prompt text + must_export only; never the tests)."""
    must = t.get("must_export")
    if must:
        names = re.findall(r"`(" + _ID + r")", must)
    else:
        first = re.split(r"(?<=[.?!])\s", t["prompt"].strip(), 1)[0]
        m = re.search(r"\b(?:[Ee]xport|Fix)\b(.*)", first)
        if not m:
            return []
        clause = re.split(r"\b(?:where|which|that|so|returning|rendering|containing|wrapping|"
                          r"supporting|displaying|accepting|showing|using|with)\b", _strip_brackets(m.group(1)))[0]
        clause = re.sub(r":[^,;]*", "", clause)  # drop return/param types after ':'
        # identifiers with an inner capital (camelCase / PascalCase) are code names, not English
        names = [n for n in re.findall(_ID, clause) if re.search(r"[a-z][A-Z]", n)]
    seen = []
    for n in names:
        if n not in seen: seen.append(n)
    return seen


def missing_exports(t, code: str) -> list[str]:
    """Required names (from the prompt) that the code does not export by name."""
    out = []
    for n in required_exports(t):
        decl = re.search(r"export\s+(?:declare\s+)?(?:async\s+)?(?:abstract\s+)?(?:function\*?|const|let|var|class|"
                         r"interface|type|enum)\s+" + re.escape(n) + r"\b", code)
        listed = any(re.search(r"(?<![\w$])" + re.escape(n) + r"(?![\w$])", grp)
                     for grp in re.findall(r"export\s+(?:type\s+)?\{([^}]*)\}", code))
        if not (decl or listed):
            out.append(n)
    return out


def compile_alone(t, code: str, max_lines=15) -> str:
    """Type-check the solution ON ITS OWN (no test file), same compiler settings as grading.
    Returns compiler errors ('' if clean). Safe to show the model: nothing about the hidden tests."""
    run = KIT / ".runs" / f"{t['id']}--tsc"
    if run.exists():
        shutil.rmtree(run)
    run.mkdir(parents=True)
    (run / f"solution{ext(t)}").write_text(code)
    _write_tsconfig(t, run)
    try:
        tsc = _run([str(KIT / "node_modules" / ".bin" / "tsc"), "-p", str(run / "tsconfig.json")],
                   cfg()["eval"]["timeout_seconds"] * 6)
    except subprocess.TimeoutExpired:
        return ""
    if tsc.returncode == 0:
        return ""
    lines = [re.sub(r"^.*?(solution\.tsx?\()", r"\1", l) for l in tsc.stdout.splitlines() if l.strip()]
    return "\n".join(lines[:max_lines])


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
    _write_tsconfig(t, run)
    bin_ = KIT / "node_modules" / ".bin"
    timeout = cfg()["eval"]["timeout_seconds"]
    try:
        tsc = _run([str(bin_ / "tsc"), "-p", str(run / "tsconfig.json")], timeout * 6)
        if tsc.returncode != 0:
            return _short_with_cause("type error: ", _tail(tsc.stdout, 2), tsc.stdout)
        vt = _run([str(bin_ / "vitest"), "run", f".runs/{t['id']}"], timeout * 6)
        if vt.returncode != 0:
            fails = re.findall(r"FAIL .*?> (.+)", vt.stdout + vt.stderr)
            full = vt.stdout + vt.stderr
            return _short_with_cause("test failed: ", "; ".join(fails[:2]) or _tail(full), full)
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


def _mode(a):
    if a.tdd:
        return "tdd+repair" if a.tdd_repair else "tdd"
    return "stream" if a.stream else "plain"


def record_run(a, results, detail_file, extra=None):
    """Append one summary row to stats/runs.jsonl (tracked in git: the project's history)."""
    n = len(results)
    rate = lambda rs: round(sum(r["passed"] for r in rs) / len(rs), 3) if rs else None  # noqa: E731
    tps = [r["tokens_per_sec"] for r in results if r.get("tokens_per_sec")]
    vram = [r["vram_mb"] for r in results if r.get("vram_mb")]
    row = {
        "date": time.strftime("%Y-%m-%d %H:%M"), "label": a.label, "model": a.model,
        "model_file": a.model_file, "mode": _mode(a), "tasks": n,
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
    if extra:
        row.update(extra)
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
    ap.add_argument("--tdd", action="store_true", help="blind TDD: 4 candidates + self-tests, pick the best")
    ap.add_argument("--tdd-repair", action="store_true", help="--tdd plus one repair turn on the pick")
    a = ap.parse_args(argv)
    a.tdd = a.tdd or a.tdd_repair
    if a.tdd and a.stream:
        ap.error("--tdd and --stream cannot be combined")

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
        elif a.tdd:
            from . import tdd
            code, info = tdd.solve(t, a)
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
            if cfg()["eval"].get("repair_retry", False):
                errors = compile_alone(t, code)
                if cfg()["eval"].get("export_check", False):  # names come from the prompt text only
                    missing = "\n".join(f"Missing required export: {n}" for n in missing_exports(t, code))
                    errors = "\n".join(x for x in (missing, errors) if x)
                    info["missing_exports_found"] = bool(missing)
                if errors:  # one retry; the model sees compiler output / missing names only, never the tests
                    lang = "tsx" if t["topic"] == "react" else "ts"
                    msgs = msgs + [{"role": "assistant", "content": out["text"]},
                                   {"role": "user", "content": "Checking your module (strict TypeScript) found:\n"
                                    f"```\n{errors}\n```\nFix these errors. Reply with the full corrected "
                                    f"module in one ```{lang} code block."}]
                    out2 = llm.chat(a.model, msgs, max_tokens=2048, temperature=0)
                    code = extract_code(out2["text"])
                    info["seconds"] = round(info["seconds"] + out2["seconds"], 2)
                    info["repaired"] = True
        ok, err, cat = run_tests_cat(t, code)
        if a.tdd and not a.reference:
            tdd.add_miss_reason(info, ok)
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
        name = f"{time.strftime('%Y%m%d-%H%M')}_{a.model}{'_stream' if a.stream else ''}{'_tdd' if a.tdd else ''}.jsonl"
        (out_dir / name).write_text("\n".join(json.dumps(r) for r in results))
        print(f"  saved results/{name}")
        extra = None
        if a.tdd:
            extra = {"tdd": tdd.summarize(results)}
            print("  tdd: " + json.dumps(extra["tdd"]))
        record_run(a, results, name, extra)
    elif passed != n:
        sys.exit(1)


if __name__ == "__main__":
    sys.exit(main())
