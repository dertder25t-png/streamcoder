"""Blind TDD + best-of-4 (Phase A step 3).

Per task: the model writes 4 candidate modules (temperature 0.7) and 2 self-test suites (temperature 0)
from the task text alone. We run every candidate against the self-tests, pick the candidate that passes
the most tests, and (stage 2, --tdd-repair) give the winner one repair turn. The hidden tests are only
used to grade the final answer and for diagnostics (never to pick or repair).

Type-only tasks (types, no runtime code) use `.typecheck.ts` files graded by tsc instead of vitest.
"""
import json
import re
import shutil
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor

from . import llm
from .config import cfg
from .eval import (KIT, SYSTEM, _run, _write_tsconfig, build_prompt, compile_alone, ext, extract_code,
                   required_exports, run_tests_cat, vram_used_mb)

N_CAND, CAND_TEMP, SUITES = 4, 0.7, "ab"

# ---------------------------------------------------------------- type-only detection

def is_type_only(t) -> bool:
    """TypeScript task whose required exports are all PascalCase names and whose prompt never
    mentions a runtime function/class."""
    names = required_exports(t)
    text = t["prompt"] + " " + (t.get("must_export") or "")
    return (t["topic"] == "typescript" and bool(names) and all(re.fullmatch(r"[A-Z]\w*", n) for n in names)
            and not re.search(r"\b(function|class|returns?)\b", text, re.I))

# ---------------------------------------------------------------- self-test prompts

SUITE_SYSTEM = ("You write small, correct unit tests for a TypeScript task. You do NOT implement the task. "
                "Only test behaviour that the task text states; never guess extra details.")
FOCUS = {"a": "CORE BEHAVIOR: the main requirements, normal inputs and outputs.",
         "b": "EDGE CASES + CLEANUP: empty or invalid input, boundaries, repeated calls, and that timers, "
              "listeners, files or other resources are cleaned up."}


def _imports_line(t) -> str:
    names = required_exports(t)
    return f"{', '.join(names)}" if names else ""


def suite_messages(t, suite: str, type_only: bool) -> list:
    names = _imports_line(t)
    if type_only:
        how = ("Write a TYPE-LEVEL test file body (no imports, no `Equal`/`Expect` definitions: they are already "
               "defined: `Equal<X, Y>` and `Expect<T extends true>`).\n"
               f"Already imported as types from the solution: {names or 'everything as S.<name>'}.\n"
               "Write 4-8 lines like `type T1 = Expect<Equal<Foo<A>, B>>;` for results that must be exactly "
               "right, and AT LEAST ONE `// @ts-expect-error` comment on the line before a statement that must "
               "NOT compile. One check per line.")
        shape = "ONE ```ts code block with the type tests"
    else:
        rules = ["Tests must be self-contained: no imports, no describe needed, no shared state between tests."]
        if t["topic"] == "react":
            rules.append("Already imported: React, render, screen, fireEvent, cleanup, act, waitFor, within "
                         "(testing-library) and test, expect, vi, afterEach, beforeEach, describe (vitest).")
            rules.append("Query only with `screen.getByRole` or text strings quoted in the task. Never use CSS "
                         "classes, tag selectors, invented labels or test ids. Use `fireEvent`, not userEvent. "
                         "Use `vi.useFakeTimers()` if timers are needed.")
        else:
            rules.append("Already imported: test, expect, vi, afterEach, beforeEach, describe (vitest)"
                         + (", and fs, path, os (node built-ins)." if t["topic"] == "node" else "."))
            if t["topic"] == "node":
                rules.append('For files use `const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "st-"))` '
                             "in each test (unique folder per test); no hardcoded paths.")
        rules.append(f"The module under test is already imported: {names}." if names else
                     "The module under test is imported as `S` (`import * as S`); call it as `S.name`.")
        how = "Rules:\n" + "\n".join(f"- {r}" for r in rules)
        shape = "ONE ```ts code block with 4-6 small `test(\"...\", () => {...})` calls, one per bullet"
    user = (f"TASK (context only; do NOT implement it):\n\n{build_prompt(t)}\n\n---\n"
            f"Write a test suite. Focus: {FOCUS[suite]}\n{how}\n\n"
            f"Reply format: FIRST a checklist, one line per requirement you will test (`- ...`). "
            f"THEN {shape}. Test bodies only.")
    return [{"role": "system", "content": SUITE_SYSTEM}, {"role": "user", "content": user}]

# ---------------------------------------------------------------- reply parsing and file assembly

def _strip_call(code: str, name: str) -> str:
    """Remove top-level `name(...)` calls (balanced parentheses)."""
    while True:
        m = re.search(rf"^{name}\s*\(", code, re.M)
        if not m:
            return code
        depth, i = 0, m.end() - 1
        while i < len(code):
            depth += code[i] == "("
            depth -= code[i] == ")"
            i += 1
            if depth == 0:
                break
        code = code[:m.start()] + code[i:].lstrip(";")


def parse_suite(reply: str, type_only: bool) -> str:
    """Code block of the reply minus imports, the model's own hooks and Equal/Expect definitions.
    Returns '' if there is no usable code block."""
    if "```" not in reply:
        return ""
    code = extract_code(reply)
    code = re.sub(r"^\s*import\b[^;]*?\bfrom\s*[\"'][^\"']+[\"'];?[ \t]*$", "", code, flags=re.M | re.S)
    code = re.sub(r"^\s*import\s*[\"'][^\"']+[\"'];?[ \t]*$", "", code, flags=re.M)
    code = re.sub(r"^\s*//\s*@vitest-environment.*$", "", code, flags=re.M)
    for hook in ("afterEach", "afterAll", "beforeAll"):
        code = _strip_call(code, hook)
    if type_only:
        code = re.sub(r"^\s*(?:export\s+)?type\s+(?:Equal|Expect)\b.*?;[ \t]*$", "", code, flags=re.M | re.S)
        ok = "Expect<" in code or "@ts-expect-error" in code
    else:
        ok = re.search(r"\b(?:test|it)\s*\(", code) is not None
    return code.strip() + "\n" if ok else ""


def test_header(t, counts_path: str) -> str:
    """Locked header we write in front of the model's test bodies (runtime suites)."""
    react = t["topic"] == "react"
    lines = ["// @vitest-environment jsdom"] if react else []
    if react:
        lines += ['import React from "react";',
                  'import { render, screen, fireEvent, cleanup, act, waitFor, within } from "@testing-library/react";']
    lines.append('import { test, it, expect, vi, afterEach, afterAll, beforeEach, describe } from "vitest";')
    if t["topic"] == "node":
        lines += ['import fs from "node:fs";', 'import path from "node:path";', 'import os from "node:os";']
    names = required_exports(t)
    lines.append(f'import {{ {", ".join(names)} }} from "./solution";' if names
                 else 'import * as S from "./solution";')
    lines.append("afterEach(() => { cleanup(); vi.useRealTimers(); });" if react
                 else "afterEach(() => { vi.useRealTimers(); });")
    # Counters for the tie-break; written at the end, never allowed to break a test.
    lines += ['import { writeFileSync as __wf } from "node:fs";',
              "const __c = { err: 0, warn: 0, unhandled: 0 };",
              "console.error = () => { __c.err++; };",
              "console.warn = () => { __c.warn++; };",
              'try { process.on("unhandledRejection", () => { __c.unhandled++; }); } catch {}',
              f"afterAll(() => {{ try {{ __wf({json.dumps(counts_path)}, JSON.stringify(__c)); }} catch {{}} }});"]
    return "\n".join(lines) + "\n\n"


TYPE_HEADER = ("type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) "
               "? true : false;\ntype Expect<T extends true> = T;\n")


def typecheck_header(t) -> str:
    names = required_exports(t)
    imp = f'import type {{ {", ".join(names)} }} from "./solution";' if names else 'import type * as S from "./solution";'
    return imp + "\n" + TYPE_HEADER + "\n"

# ---------------------------------------------------------------- type-check grading (pure)

_EXPECT = re.compile(r"^\s*(?:export\s+)?type\s+\w+(?:<[^>]*>)?\s*=\s*Expect<")


def typecheck_tests(text: str) -> list:
    """[(line_no, kind, name)] for every `type X = Expect<...>` statement and `@ts-expect-error` line."""
    out = []
    for n, line in enumerate(text.splitlines(), 1):
        if "@ts-expect-error" in line:
            out.append((n, "exp", f"{n}: {line.strip()[:70]}"))
        elif _EXPECT.match(line):
            out.append((n, "expect", f"{n}: {line.strip()[:70]}"))
    return out


def grade_typecheck(text: str, header_len: int, errors: list) -> dict:
    """errors = [(line, 'TS2578'), ...] reported for this file. Returns {test name: passed}.
    Errors inside the header (e.g. a missing export) fail every test. A `type ... = Expect<...>` test
    fails on any error inside its statement; a `@ts-expect-error` test fails on TS2578 (unused directive)."""
    tests = typecheck_tests(text)
    lines = text.splitlines()
    broken = any(ln <= header_len for ln, _ in errors)
    res = {}
    for i, (ln, kind, name) in enumerate(tests):
        if kind == "exp":
            bad = any(l == ln and code == "TS2578" for l, code in errors)
        else:
            nxt = tests[i + 1][0] if i + 1 < len(tests) else len(lines) + 1
            end = ln
            while end < nxt - 1 and not lines[end - 1].rstrip().endswith(";"):
                end += 1
            bad = any(ln <= l <= end for l, _ in errors)
        res[name] = not (bad or broken)
    return res

# ---------------------------------------------------------------- scoring (pure)

def score_tests(oks: list) -> dict:
    """oks[i] = {test key: passed} for candidate i. Tests that fail on every candidate (0/N) are ignored;
    score = passes on the remaining tests. A key missing for a candidate (crashed suite) counts as failed."""
    keys = sorted(set().union(*[set(o) for o in oks])) if oks else []
    passes = {k: sum(bool(o.get(k)) for o in oks) for k in keys}
    kept = [k for k in keys if passes[k] > 0]
    return {"keys": kept, "scores": [sum(bool(o.get(k)) for k in kept) for o in oks],
            "n_tests": len(keys), "n_zero": len(keys) - len(kept),
            "n_all": sum(passes[k] == len(oks) for k in keys)}


def pick(scores: list, tiebreak) -> tuple:
    """Best self-test score wins; ties go to the smallest tiebreak(i) tuple (only computed for tied ones).
    Returns (index, top_tie) where top_tie says several candidates shared the top score."""
    top = max(scores)
    tied = [i for i, s in enumerate(scores) if s == top]
    return min(tied, key=tiebreak), len(tied) > 1


def miss_reason(scores: list, picked: int, hidden: list):
    """Why the picker missed although some candidate passes the hidden tests (else None)."""
    good = [i for i, h in enumerate(hidden) if h]
    if not good or hidden[picked]:
        return None
    return "self-test" if all(scores[i] < scores[picked] for i in good) else "tie-break"

# ---------------------------------------------------------------- running self-tests

def _run_dir(t, name: str):
    run = KIT / ".runs" / f"tdd--{t['id']}--{name}"   # "tdd--" prefix: hidden grading's `.runs/<id>` filter must not match
    if run.exists():
        shutil.rmtree(run)
    run.mkdir(parents=True)
    return run


def write_run(t, name: str, code: str, suites: dict, type_only: bool):
    run = _run_dir(t, name)
    (run / f"solution{ext(t)}").write_text(code)
    meta = {}
    for s, body in suites.items():
        if type_only:
            head = typecheck_header(t)
            (run / f"selftest_{s}.typecheck.ts").write_text(head + body)
            meta[s] = head.count("\n")
        else:
            (run / f"selftest_{s}.test{ext(t)}").write_text(test_header(t, str(run / f"counts_{s}.json")) + body)
    _write_tsconfig(t, run)  # tsc for type checks; also tells vitest/esbuild to use the react-jsx transform
    return run, meta


def _short_msg(msgs) -> str:
    first = next((l.strip() for m in msgs for l in str(m).splitlines() if l.strip()), "")
    return first[:160]


def parse_vitest_json(data: dict) -> dict:
    """{'a::test name': (passed, short error)}. A crashed suite file has no entries (= all failed)."""
    res = {}
    for f in data.get("testResults", []):
        m = re.search(r"selftest_(\w)\.test", f.get("name", ""))
        if not m:
            continue
        for a in f.get("assertionResults", []):
            key = f"{m.group(1)}::{' > '.join(a.get('ancestorTitles', []) + [a['title']])}"
            while key in res:
                key += "'"
            res[key] = (a.get("status") == "passed", _short_msg(a.get("failureMessages", [])))
    return res


def _timeout() -> int:
    return cfg()["eval"]["timeout_seconds"] * 6


def run_selftests(t, run, meta: dict, type_only: bool) -> dict:
    """Grade one run dir. Returns {'a::name': (passed, short error)}."""
    bin_ = KIT / "node_modules" / ".bin"
    try:
        if type_only:
            tsc = _run([str(bin_ / "tsc"), "-p", str(run / "tsconfig.json")], _timeout())
            res = {}
            for s, hlen in meta.items():
                errs = [(int(m.group(1)), m.group(2)) for m in
                        re.finditer(rf"selftest_{s}\.typecheck\.ts\((\d+),\d+\): error (TS\d+)", tsc.stdout)]
                text = (run / f"selftest_{s}.typecheck.ts").read_text()
                for name, ok in grade_typecheck(text, hlen, errs).items():
                    res[f"{s}::{name}"] = (ok, "" if ok else "type check failed")
            return res
        out = run / "result.json"
        _run([str(bin_ / "vitest"), "run", f".runs/{run.name}", "--reporter=json", f"--outputFile={out}"], _timeout())
        return parse_vitest_json(json.loads(out.read_text()))
    except (subprocess.TimeoutExpired, OSError, ValueError):
        return {}


def read_counts(run) -> dict:
    tot = {"err": 0, "warn": 0, "unhandled": 0}
    for s in SUITES:
        try:
            for k, v in json.loads((run / f"counts_{s}.json").read_text()).items():
                tot[k] += int(v)
        except (OSError, ValueError, KeyError, TypeError):
            pass
    return tot

# ---------------------------------------------------------------- repair

def build_repair(t, base: list, answer: str, failing: list, suites: dict) -> list:
    lang = "tsx" if t["topic"] == "react" else "ts"
    fails = "\n".join(f"- {k}: {msg or 'failed'}" for k, msg in failing)
    code = "\n\n".join(f"// suite {s}\n{b}" for s, b in suites.items() if b)
    ask = ("Self-tests (written from the task text, so a test may itself be wrong) found problems in your module.\n"
           f"Failing tests:\n{fails}\n\nTest code:\n```ts\n{code}\n```\n"
           "Fix the module where a failing test matches the task requirements. "
           f"Reply with the full corrected module in one ```{lang} code block.")
    return base + [{"role": "assistant", "content": answer}, {"role": "user", "content": ask}]

# ---------------------------------------------------------------- main entry

def _chat(model, msgs, max_tokens, temperature) -> dict:
    try:
        return llm.chat(model, msgs, max_tokens=max_tokens, temperature=temperature)
    except Exception as e:  # one failed request must not kill the whole run
        return {"text": "", "seconds": 0, "completion_tokens": 0, "error": str(e)[:100]}


def solve(t, a):
    """Returns (final code, info dict). info['seconds'] covers generation + self-tests + repair only."""
    t0 = time.time()
    type_only = is_type_only(t)
    base = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": build_prompt(t)}]
    with ThreadPoolExecutor(6) as ex:
        sf = {s: ex.submit(_chat, a.model, suite_messages(t, s, type_only), 1536, 0) for s in SUITES}
        cf = [ex.submit(_chat, a.model, base, 2048, CAND_TEMP) for _ in range(N_CAND)]
        suites = {s: parse_suite(f.result()["text"], type_only) for s, f in sf.items()}
        outs = [f.result() for f in cf]
    gen_secs = time.time() - t0
    codes = [extract_code(o["text"]) for o in outs]

    runs = [write_run(t, f"cand{k}", c, suites, type_only) for k, c in enumerate(codes)]
    try:
        with ThreadPoolExecutor(N_CAND) as ex:
            res = list(ex.map(lambda r: run_selftests(t, r[0], r[1], type_only), runs))
        counts = [read_counts(r[0]) for r in runs]
        sc = score_tests([{k: v[0] for k, v in r.items()} for r in res])

        def tiebreak(i):  # fewer tsc errors, fewer console problems, fewer unhandled rejections, lowest index
            c = counts[i]
            return (len(compile_alone(t, codes[i], 999).splitlines()), c["err"] + c["warn"], c["unhandled"], i)
        picked, top_tie = pick(sc["scores"], tiebreak)
        final, info = codes[picked], {}

        # stage 2: one repair turn if the pick fails a test that another candidate passes
        info.update(repair_called=False, repair_kept=False, repaired_passed=None)
        if getattr(a, "tdd_repair", False):
            failing = [(k, res[picked].get(k, (False, "suite crashed"))[1]) for k in sc["keys"]
                       if not res[picked].get(k, (False,))[0] and any(r.get(k, (False,))[0] for r in res)]
            if failing:
                info["repair_called"] = True
                msgs = build_repair(t, base, outs[picked]["text"], failing, suites)
                out2 = _chat(a.model, msgs, 2048, 0)
                code2 = extract_code(out2["text"])
                run2 = write_run(t, "repair", code2, suites, type_only)
                res2 = run_selftests(t, run2[0], run2[1], type_only)
                if sum(bool(res2.get(k, (False,))[0]) for k in sc["keys"]) > sc["scores"][picked]:
                    final, info["repair_kept"] = code2, True
        seconds = round(time.time() - t0, 2)
    finally:
        for r in runs:
            shutil.rmtree(r[0], ignore_errors=True)
        shutil.rmtree(KIT / ".runs" / f"tdd--{t['id']}--repair", ignore_errors=True)

    # diagnostics (hidden tests; excluded from `seconds`)
    cand_hidden = [run_tests_cat(t, c)[0] for c in codes]
    if info["repair_kept"]:
        info["repaired_passed"] = run_tests_cat(t, final)[0]
    toks = sum(o.get("completion_tokens") or 0 for o in outs)
    info.update(seconds=seconds, tokens_per_sec=round(toks / gen_secs, 1) if gen_secs and toks else None,
                vram_mb=vram_used_mb(), type_only=type_only, suites_ok=[bool(suites[s]) for s in SUITES],
                cand_hidden=cand_hidden, cand_scores=sc["scores"], picked=picked, top_tie=top_tie,
                n_tests=sc["n_tests"], n_zero=sc["n_zero"], n_all=sc["n_all"], oracle=any(cand_hidden))
    return final, info


def add_miss_reason(info: dict, passed: bool):
    """Call after the final hidden grade: tags why the pick failed although a candidate was good."""
    info["miss_reason"] = None if passed else miss_reason(info["cand_scores"], info["picked"], info["cand_hidden"])

# ---------------------------------------------------------------- summary for the stat sheet

def summarize(results: list) -> dict:
    def block(rs):
        n, orc = len(rs), [r for r in rs if r["oracle"]]
        nt = sum(r["n_tests"] for r in rs)
        div = lambda x, y: round(x / y, 3) if y else None  # noqa: E731
        return {"tasks": n, "oracle_rate": div(len(orc), n),
                "picker_accuracy": div(sum(r["passed"] for r in orc), len(orc)),
                "top_tie_rate": div(sum(r["top_tie"] for r in rs), n),
                "zero_share": div(sum(r["n_zero"] for r in rs), nt), "all_share": div(sum(r["n_all"] for r in rs), nt),
                "misses": {k: sum(r.get("miss_reason") == k for r in rs) for k in ("self-test", "tie-break")},
                "repair_called": sum(r["repair_called"] for r in rs), "repair_kept": sum(r["repair_kept"] for r in rs)}
    out = block(results)
    out["by_topic"] = {tp: block([r for r in results if r["topic"] == tp])
                       for tp in ("typescript", "react", "node") if any(r["topic"] == tp for r in results)}
    return out
