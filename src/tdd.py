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
                   missing_exports, required_exports, run_tests_cat, vram_used_mb)

N_CAND, CAND_TEMP, SUITES = 4, 0.7, "ab"


def cand_plan(n: int) -> tuple:
    """cand0 at temperature 0 (no seed); cand1..n-1 at temperature 0.7 with seeds 1..n-1.
    Shared by tools/freeze.py and solve() so offline and live candidates are identical."""
    return [0] + [CAND_TEMP] * (n - 1), [None] + list(range(1, n))

# ---------------------------------------------------------------- type-only detection

def is_type_only(t) -> bool:
    """TypeScript task whose required exports are all PascalCase names and whose prompt never
    mentions a runtime function/class."""
    names = required_exports(t)
    text = t["prompt"] + " " + (t.get("must_export") or "")
    return (t["topic"] == "typescript" and bool(names) and all(re.fullmatch(r"[A-Z]\w*", n) for n in names)
            and not re.search(r"\b(function|class|returns?)\b", text, re.I))

def hook_names(t) -> list:
    """Required exports that look like React hooks (`useX`) in a React task."""
    if t["topic"] != "react":
        return []
    return [n for n in required_exports(t) if re.match(r"use[A-Z]", n)]


def is_hook_task(t) -> bool:
    return bool(hook_names(t))


def hook_rule(t) -> str:
    return (f"Test hooks only via `const {{ result, rerender, unmount }} = renderHook(() => {hook_names(t)[0]}(...))`; "
            "never call `use*` directly in a test.")

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
            rules.append("Already imported: React, render, renderHook, screen, fireEvent, cleanup, act, waitFor, within "
                         "(testing-library) and test, expect, vi, afterEach, beforeEach, describe (vitest).")
            if is_hook_task(t):
                rules.append(hook_rule(t))
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


_HOOK_CALL = re.compile(r"(?<![.\w$])use[A-Z]\w*\s*\(")
_TEST_START = re.compile(r"^[ \t]*(?:test|it)(?:\.\w+)*\s*\(", re.M)
_COMPONENT = re.compile(r"function\s+[A-Z]\w*\s*\([^)]*\)\s*(?::[^{]*)?\{"
                        r"|const\s+[A-Z]\w*\s*(?::[^=]*)?=\s*(?:\([^)]*\)|\w+)\s*(?::[^=]*?)?=>\s*\{")


def _balanced_end(code: str, i: int, open_c: str, close_c: str) -> int:
    """Index just past the bracket matching code[i] (== open_c); len(code) if unbalanced. Skips strings."""
    depth, q = 0, None
    while i < len(code):
        c = code[i]
        if q:
            if c == "\\":
                i += 1
            elif c == q:
                q = None
        elif c in "\"'`":
            q = c
        elif c == open_c:
            depth += 1
        elif c == close_c:
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    return len(code)


def _bare_hook_call(block: str) -> bool:
    spans = []
    for m in re.finditer(r"\brenderHook\s*\(", block):
        spans.append((m.start(), _balanced_end(block, m.end() - 1, "(", ")")))
    for m in _COMPONENT.finditer(block):
        spans.append((m.start(), _balanced_end(block, m.end() - 1, "{", "}")))
    for m in _HOOK_CALL.finditer(block):
        if re.search(r"function\s+$", block[:m.start()]):   # a hook being DEFINED in the test, not called
            continue
        if not any(a <= m.start() < b for a, b in spans):
            return True
    return False


def drop_bare_hook_tests(code: str) -> tuple:
    """Drop top-level `test(`/`it(` blocks that call `useX(` outside renderHook(...) and outside a component
    function defined in the block. Returns (code, n_dropped). Conservative: only drops when clearly outside."""
    out, pos, dropped = [], 0, 0
    while True:
        m = _TEST_START.search(code, pos)
        if not m:
            break
        end = _balanced_end(code, m.end() - 1, "(", ")")
        if end < len(code) and code[end:end + 1] == ";":
            end += 1
        if _bare_hook_call(code[m.start():end]):
            out.append(code[pos:m.start()])
            dropped += 1
        else:
            out.append(code[pos:end])
        pos = end
    out.append(code[pos:])
    return "".join(out), dropped


def parse_suite_n(reply: str, type_only: bool, hook: bool = False) -> tuple:
    """Like parse_suite but returns (suite, hook_tests_dropped). `hook`: apply the bare-hook-call filter."""
    if "```" not in reply:
        return "", 0
    code = _clean_body(reply)
    dropped = 0
    if type_only:
        code = re.sub(r"^\s*(?:export\s+)?type\s+(?:Equal|Expect)\b.*?;[ \t]*$", "", code, flags=re.M | re.S)
        ok = "Expect<" in code or "@ts-expect-error" in code
    else:
        if hook:
            code, dropped = drop_bare_hook_tests(code)
        ok = re.search(r"\b(?:test|it)\s*\(", code) is not None
    return (code.strip() + "\n" if ok else ""), dropped


def parse_suite(reply: str, type_only: bool, hook: bool = False) -> str:
    """Code block of the reply minus imports, the model's own hooks and Equal/Expect definitions (and, for hook
    tasks with hook=True, tests that call a hook outside renderHook). Returns '' if there is no usable code."""
    return parse_suite_n(reply, type_only, hook)[0]


_ID = r"[A-Za-z_$][\w$]*"
_BUILTINS = {"fs", "fs/promises", "path", "os", "stream", "stream/promises", "http", "https", "events", "crypto",
             "util", "url", "zlib", "child_process", "readline", "buffer", "timers", "timers/promises",
             "string_decoder", "assert", "net", "worker_threads", "perf_hooks"}
_HEADER_NAMES = {"fs", "fsBase", "path", "os", "React", "http", "EventEmitter", "Readable", "Writable",
                 "PassThrough", "Transform"}  # bound by our locked header
_IMPORT = re.compile(r"^[ \t]*import\b([^;]*?)\bfrom\s*[\"']([^\"']+)[\"'];?[ \t]*(?://[^\n]*)?$", re.M | re.S)


def _bound_names(clause: str) -> list:
    """Local names an import clause binds: `a, { b, c as d }, * as e` -> [a, b, d, e]."""
    clause = re.sub(r"\btype\b", " ", clause)
    out = []
    for part in re.split(r",(?![^{]*})", clause):
        part = part.strip()
        if part.startswith("{"):
            out += [x.split(" as ")[-1].strip() for x in part.strip("{} \n").split(",") if x.strip()]
        elif part.startswith("*"):
            out.append(part.split(" as ")[-1].strip())
        elif part:
            out.append(part)
    return [n for n in out if re.fullmatch(_ID, n)]


def _fix_import(m) -> str:
    """Our header owns the imports, but the model's own imports still matter:
    - from './solution' (or './<fnName>'): keep the NAMES (merged into our solution import, see test_header)
    - from a Node built-in: keep the line (join, Readable, http...), unless it re-binds a header name
    - anything else (vitest, testing-library, react): drop, the header has it."""
    clause, src = m.group(1), m.group(2)
    if src.startswith("."):
        named = re.search(r"\{([^}]*)\}", clause)
        names = [x.split(" as ")[0].replace("type ", "").strip() for x in named.group(1).split(",")] if named else []
        names = [n for n in names if re.fullmatch(_ID, n)]
        return f"//@sol-names {' '.join(names)}" if names else ""
    if src.removeprefix("node:") in _BUILTINS and not set(_bound_names(clause)) & _HEADER_NAMES:
        return f"import{clause}from \"{src}\";"
    return ""


def sol_names(body: str) -> list:
    return [n for line in re.findall(r"^//@sol-names (.*)$", body, re.M) for n in line.split()]


def _clean_body(reply: str) -> str:
    """Code block of a reply minus our-header imports, @vitest-environment lines and the model's own hooks."""
    code = extract_code(reply)
    code = _IMPORT.sub(_fix_import, code)
    code = re.sub(r"^\s*import\s*[\"'][^\"']+[\"'];?[ \t]*(?://[^\n]*)?$", "", code, flags=re.M)
    code = re.sub(r"^\s*//\s*@vitest-environment.*$", "", code, flags=re.M)
    for hook in ("afterEach", "afterAll", "beforeAll"):
        code = _strip_call(code, hook)
    return code


def test_header(t, counts_path: str, body: str = "") -> str:
    """Locked header we write in front of the model's test bodies (runtime suites)."""
    react = t["topic"] == "react"
    lines = ["// @vitest-environment jsdom"] if react else []
    if react:
        lines += ['import React from "react";',
                  'import { render, renderHook, screen, fireEvent, cleanup, act, waitFor, within } from "@testing-library/react";',
                  'import "@testing-library/jest-dom/vitest";  // toBeInTheDocument etc. (models use them a lot)']
    lines.append('import { test, it, expect, vi, afterEach, afterAll, beforeEach, describe } from "vitest";')
    if t["topic"] == "node":
        # fs is promise-first (models write `await fs.mkdtemp(...)`); sync calls still work (spread copy).
        lines += ['import fsBase from "node:fs";',
                  'const fs = { ...fsBase, ...fsBase.promises, promises: fsBase.promises };',
                  'import path from "node:path";', 'import os from "node:os";', 'import http from "node:http";',
                  'import { EventEmitter } from "node:events";',
                  'import { Readable, Writable, PassThrough, Transform } from "node:stream";']
    names = list(dict.fromkeys(required_exports(t) + sol_names(body)))  # prompt names + names the tests import
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
        out = _run([str(KIT / "node_modules" / ".bin" / "tsc"), "-p", str(run / "tsconfig.json")], _timeout())
        return len(re.findall(r"error TS\d+", out.stdout))
    except Exception:
        return 0
    finally:
        shutil.rmtree(run, ignore_errors=True)


def _smoke(t, code: str, k: int) -> dict:
    run = _run_dir(t, f"pk{k}smoke")
    try:
        (run / f"solution{ext(t)}").write_text(code)
        out = run / "smoke.json"
        src = _smoke_file(t).replace("OUTPATH", json.dumps(str(out)))
        (run / f"smoke.test{ext(t)}").write_text(src)
        _write_tsconfig(t, run)
        _run([str(KIT / "node_modules" / ".bin" / "vitest"), "run", f".runs/{run.name}", "--reporter=json",
              f"--outputFile={run / 'result.json'}"], _timeout())
        d = json.loads(out.read_text())
        return {"ok": bool(d.get("import_ok")), "error": d.get("import_error", ""),
                "render_errors": d.get("render_errors", [])}
    except Exception as e:  # smoke file never wrote its result (crash/timeout at import) => failed
        return {"ok": False, "error": f"no result: {type(e).__name__}", "render_errors": []}
    finally:
        shutil.rmtree(run, ignore_errors=True)


def filter_survivors(cands: list) -> list:
    """Zero-LLM filter: drop candidates with tsc errors, missing exports or a failed smoke import.
    cands[i] needs "tsc", "missing", "smoke". If none survive, keep all."""
    ok = [i for i, c in enumerate(cands) if c["tsc"] == 0 and not c["missing"] and c["smoke"]["ok"]]
    return ok or list(range(len(cands)))


def filter_features(t, k: int, code: str) -> dict:
    return {"tsc": _tsc_count(t, code, k), "missing": missing_exports(t, code), "smoke": _smoke(t, code, k)}

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
            (run / f"selftest_{s}.test{ext(t)}").write_text(test_header(t, str(run / f"counts_{s}.json"), body) + body)
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

# ---------------------------------------------------------------- MBR-Exec input drivers

DRIVER_SYSTEM = ("You write INPUT DRIVERS for a TypeScript task: small snippets that exercise a module and return "
                 "what it produced. You do NOT implement the task and you do NOT write expected values or asserts.")


def driver_messages(t) -> list:
    names = _imports_line(t)
    react = t["topic"] == "react"
    rules = ["No imports, no asserts, no expected values: just exercise the module and RETURN a value. "
             "Never call `expect` (no `toBe...`, `toHave...`); the returned value is compared for you.",
             "Each probe is `probe(\"short name\", async () => { ...; return value; })`. "
             "`probe` is already defined."]
    if react:
        rules.append("Already imported: React, render, renderHook, screen, fireEvent, cleanup, act, waitFor, within "
                     "(testing-library) and vi (vitest).")
        if is_hook_task(t):
            rules.append(hook_rule(t))
        rules.append("Render the component with props taken from the task, then do a sequence of `fireEvent` "
                     "interactions. Query only with `screen.getByRole` (not getByLabelText / getByTestId) or text strings quoted in the task. Never "
                     "use CSS classes, tag selectors, invented labels or test ids. End with `return snap();` "
                     "(`snap()` is provided and returns the page HTML). Use `vi.useFakeTimers()` if timers are needed.")
    else:
        rules.append("Already imported: vi (vitest)"
                     + (", and fs, path, os (node built-ins)." if t["topic"] == "node" else "."))
        rules.append("Call the exported functions with varied arguments, including edge cases (empty, zero, "
                     "boundaries, invalid input), and return the result (wrap it in an object/array if you "
                     "make several calls).")
        if t["topic"] == "node":
            rules.append('For files use `const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "pr-"))` '
                         "inside each probe (unique folder), and return what was written or read.")
    rules.append(f"The module under test is already imported: {names}." if names else
                 "The module under test is imported as `S` (`import * as S`); call it as `S.name`.")
    user = (f"TASK (context only; do NOT implement it):\n\n{build_prompt(t)}\n\n---\n"
            "Write 4-6 probes.\nRules:\n" + "\n".join(f"- {r}" for r in rules) +
            "\n\nReply with ONE ```ts code block containing only the `probe(...)` calls.")
    return [{"role": "system", "content": DRIVER_SYSTEM}, {"role": "user", "content": user}]


_PROBE_RUNTIME = r"""
const snap = () => (typeof document === "undefined" ? "" : document.body.innerHTML);
const __fp: Record<string, any> = {};
const __st = setTimeout, __ct = clearTimeout;
function __stable(v: any, seen: any[] = []): any {
  if (v === undefined) return "__undefined";
  if (typeof v === "function") return "__function";
  if (typeof v === "bigint" || typeof v === "symbol") return String(v);
  if (typeof v === "number") return Number.isFinite(v) ? v : String(v);
  if (v === null || typeof v !== "object") return v;
  if (seen.includes(v)) return "__cycle";
  seen = [...seen, v];
  if (v instanceof Date) return { __date: isNaN(+v) ? "invalid" : v.toISOString() };
  if (v instanceof Error) return { __error: v.constructor.name, message: v.message };
  if (v instanceof Map) return { __map: [...v.entries()].map(([k, x]) => [__stable(k, seen), __stable(x, seen)]) };
  if (v instanceof Set) return { __set: [...v.values()].map((x) => __stable(x, seen)) };
  if (Array.isArray(v)) return v.map((x) => __stable(x, seen));
  const o: Record<string, any> = {};
  for (const k of Object.keys(v).sort()) o[k] = __stable(v[k], seen);
  return o;
}
const stableJSON = (v: any): string => { try { return JSON.stringify(__stable(v)); } catch { return "__unserializable"; } };
function probe(name: string, fn: () => any) {
  test(name, async () => {
    let timer: any;
    try {
      const r = await Promise.race([Promise.resolve().then(fn),
        new Promise((_, rej) => { timer = __st(() => rej(new Error("probe timeout")), 3000); })]);
      __fp[name] = { ok: true, value: stableJSON(r) };
    } catch (e: any) {
      __fp[name] = { ok: false, error: (e && e.constructor && e.constructor.name) || "Error" };
    } finally { __ct(timer); }
  }, 10000);
}
"""


def driver_file(t, raw: str, fp_path: str, counts_path: str | None = None) -> str:
    """Runnable vitest file for the model's probes: locked header + probe runtime + cleaned probe code.
    The fingerprint JSON {name: {ok, value|error}} is written to fp_path after the run."""
    body = _clean_body(raw) if "```" in raw else ""
    head = test_header(t, counts_path or fp_path + ".counts", body)
    tail = (f"\nafterAll(() => {{ try {{ __wf({json.dumps(fp_path)}, JSON.stringify(__fp)); }} catch {{}} }});\n")
    return head + _PROBE_RUNTIME + "\n" + body.strip() + "\n" + tail


def run_probes(t, code: str, raw: str, tag: str = "probe") -> dict:
    """Run the driver against one candidate module. Returns {probe name: {ok, value|error}} ({} on crash)."""
    run = _run_dir(t, tag)
    try:
        (run / f"solution{ext(t)}").write_text(code)
        fp = run / "fp.json"
        (run / f"probes.test{ext(t)}").write_text(driver_file(t, raw, str(fp)))
        _write_tsconfig(t, run)
        _run([str(KIT / "node_modules" / ".bin" / "vitest"), "run", f".runs/{run.name}", "--reporter=json",
              f"--outputFile={run / 'result.json'}"], _timeout())
        return json.loads(fp.read_text())
    except (subprocess.TimeoutExpired, OSError, ValueError):
        return {}
    finally:
        shutil.rmtree(run, ignore_errors=True)

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

CAND_CAP = 1536   # --tdd-fast: max tokens per candidate


def cand_messages(t, fast: bool = False) -> list:
    """Candidate request messages. fast=False is byte-identical to the plain prompt (SYSTEM + build_prompt)."""
    user = build_prompt(t) + ("\n\nNo JSDoc comments." if fast else "")
    return [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}]


def gen_candidate(model, t, base: list, temp, seed, fast: bool = False) -> dict:
    """One candidate request. fast: prefill the opening code fence, stop at the closing fence, cap tokens.
    The returned text always has both fences again, so extract_code works as before.
    out['capped'] is True when the reply hit the token cap (finish_reason == 'length')."""
    if not fast:
        o = _chat(model, base, 2048, temp, seed)
    else:
        fence = f"```{'tsx' if t['topic'] == 'react' else 'ts'}\n"
        o = _chat(model, base, CAND_CAP, temp, seed, stop=["\n```"], prefill=fence)
        if "error" not in o:
            # this llama-server build returns the prefill as part of the content; add it only if it is missing
            o["text"] = (o["text"] if o["text"].startswith(fence) else fence + o["text"]) + "\n```"
    o["capped"] = o.get("finish_reason") == "length"
    return o

# ---------------------------------------------------------------- batched scoring (one tsc + one vitest for all candidates)

def _write_cand(t, d, code: str, suites: dict, type_only: bool, smoke: bool) -> dict:
    d.mkdir(parents=True)
    (d / f"solution{ext(t)}").write_text(code)
    meta = {}
    for s, body in suites.items():
        if type_only:
            head = typecheck_header(t)
            (d / f"selftest_{s}.typecheck.ts").write_text(head + body)
            meta[s] = head.count("\n")
        else:
            (d / f"selftest_{s}.test{ext(t)}").write_text(test_header(t, str(d / f"counts_{s}.json"), body) + body)
    if smoke:
        (d / f"smoke.test{ext(t)}").write_text(_smoke_file(t).replace("OUTPATH", json.dumps(str(d / "smoke.json"))))
    return meta


def parse_vitest_batch(data: dict) -> dict:
    """{cand index: parse_vitest_json-style dict} from one vitest run over candK/ folders."""
    per = {}
    for f in data.get("testResults", []):
        m = re.search(r"/cand(\d+)/selftest_", f.get("name", ""))
        if m:
            per.setdefault(int(m.group(1)), []).append(f)
    return {k: parse_vitest_json({"testResults": fs}) for k, fs in per.items()}


def tsc_by_cand(out: str, n: int) -> tuple:
    """(solution error counts, solution output line counts, {(k, suite): [(line, code)]} selftest errors)."""
    cnt, lines, st = [0] * n, [0] * n, {}
    cur = None
    for l in out.splitlines():
        if not l.strip():
            continue
        m = re.search(r"cand(\d+)/(solution\.tsx?|selftest_(\w)\.typecheck\.ts)\((\d+),\d+\): error (TS\d+)", l)
        if m and int(m.group(1)) < n:
            k = int(m.group(1))
            if m.group(3):
                st.setdefault((k, m.group(3)), []).append((int(m.group(4)), m.group(5)))
                cur = None
            else:
                cnt[k] += 1
                lines[k] += 1
                cur = k
        elif re.match(r"\S.*\(\d+,\d+\): error", l):
            cur = None                       # an error in some other file ends the previous one
        elif l[0] in " \t" and cur is not None:
            lines[cur] += 1                  # continuation line of a multi-line error
    return cnt, lines, st


def batch_score(t, codes: list, suites: dict, type_only: bool, smoke: bool = False):
    """Score all candidates with ONE tsc call and (unless type-only without smoke) ONE vitest run.
    Returns dict(res, counts, tsc_n, tsc_lines, smoke, t_tsc, t_vitest) or None if a tool timed out / crashed
    (the caller then falls back to the per-candidate path, so one hanging candidate cannot lose the others)."""
    if type_only:   # one syntax error anywhere stops tsc's semantic pass for the whole program: score these one by one
        return None
    n = len(codes)
    run = _run_dir(t, "batch")
    bin_ = KIT / "node_modules" / ".bin"
    try:
        metas = [_write_cand(t, run / f"cand{k}", c, suites, type_only, smoke) for k, c in enumerate(codes)]
        _write_tsconfig(t, run)                      # react: node-shim.d.ts + base config
        base = json.loads((run / "tsconfig.json").read_text())
        # moduleDetection=force: candidates that forgot `export` are scripts whose globals would clash across folders
        base["compilerOptions"] = dict(base.get("compilerOptions", {}), moduleDetection="force")
        cfg_tsc = dict(base, include=["./node-shim.d.ts", "./cand*/solution.ts", "./cand*/solution.tsx"]
                       + (["./cand*/*.typecheck.ts"] if type_only else []))
        (run / "tsconfig.tsc.json").write_text(json.dumps(cfg_tsc))
        base["include"] = ["./*.ts", "./cand*/*.ts", "./cand*/*.tsx"]   # vitest/esbuild: jsx settings reach every folder
        (run / "tsconfig.json").write_text(json.dumps(base))
        t1 = time.time()
        tsc = _run([str(bin_ / "tsc"), "-p", str(run / "tsconfig.tsc.json")], _timeout())
        tsc_n, tsc_lines, st = tsc_by_cand(tsc.stdout, n)
        # a syntax error (TS1xxx) in one file stops tsc's semantic pass for the whole program: rerun without those
        bad = sorted({int(m.group(1)) for m in re.finditer(r"cand(\d+)/solution\.tsx?\(\d+,\d+\): error TS1\d{3}\b", tsc.stdout)})
        if bad:
            good = [k for k in range(n) if k not in bad]
            if good:
                cfg2 = dict(cfg_tsc, include=["./node-shim.d.ts"] + [f"./cand{k}/solution{ext(t)}" for k in good])
                (run / "tsconfig.tsc2.json").write_text(json.dumps(cfg2))
                tsc2 = _run([str(bin_ / "tsc"), "-p", str(run / "tsconfig.tsc2.json")], _timeout())
                n2, l2, _ = tsc_by_cand(tsc2.stdout, n)
                for k in good:
                    tsc_n[k], tsc_lines[k] = n2[k], l2[k]
        t_tsc = time.time() - t1
        t1 = time.time()
        res = [{} for _ in range(n)]
        if type_only:
            for k in range(n):
                for s, hlen in metas[k].items():
                    text = (run / f"cand{k}" / f"selftest_{s}.typecheck.ts").read_text()
                    for name, ok in grade_typecheck(text, hlen, st.get((k, s), [])).items():
                        res[k][f"{s}::{name}"] = (ok, "" if ok else "type check failed")
        if not type_only or smoke:
            out = run / "result.json"
            _run([str(bin_ / "vitest"), "run", f".runs/{run.name}", "--reporter=json", f"--outputFile={out}"], _timeout())
            per = parse_vitest_batch(json.loads(out.read_text()))
            if not type_only:
                res = [per.get(k, {}) for k in range(n)]
        t_vitest = time.time() - t1
        sm = []
        for k in range(n):
            if not smoke:
                sm.append(None)
                continue
            try:
                d = json.loads((run / f"cand{k}" / "smoke.json").read_text())
                sm.append({"ok": bool(d.get("import_ok")), "error": d.get("import_error", ""),
                           "render_errors": d.get("render_errors", [])})
            except (OSError, ValueError):
                sm.append({"ok": False, "error": "no result: smoke wrote nothing", "render_errors": []})
        counts = [read_counts(run / f"cand{k}") for k in range(n)]
        return dict(res=res, counts=counts, tsc_n=tsc_n, tsc_lines=tsc_lines, smoke=sm, t_tsc=t_tsc, t_vitest=t_vitest)
    except (subprocess.TimeoutExpired, OSError, ValueError):
        return None
    finally:
        shutil.rmtree(run, ignore_errors=True)


def _chat(model, msgs, max_tokens, temperature, seed=None, stop=None, prefill=None) -> dict:
    try:
        return llm.chat(model, msgs, max_tokens=max_tokens, temperature=temperature, seed=seed,
                        stop=stop, prefill=prefill)
    except Exception as e:  # one failed request must not kill the whole run
        return {"text": "", "seconds": 0, "completion_tokens": 0, "error": str(e)[:100]}


def _score_old(t, codes, suites, type_only, use_filter):
    """Per-candidate fallback (and reference path): run_selftests + compile_alone + filter features."""
    k_n = len(codes)
    runs = [write_run(t, f"cand{k}", c, suites, type_only) for k, c in enumerate(codes)]
    try:
        with ThreadPoolExecutor(k_n) as ex:
            res = list(ex.map(lambda r: run_selftests(t, r[0], r[1], type_only), runs))
            feats = list(ex.map(lambda kc: filter_features(t, *kc), enumerate(codes))) if use_filter else None
        counts = [read_counts(r[0]) for r in runs]
    finally:
        for r in runs:
            shutil.rmtree(r[0], ignore_errors=True)
    lines = [len(compile_alone(t, c, 999).splitlines()) for c in codes]
    return res, counts, lines, feats


def solve(t, a):
    """Returns (final code, info dict). info['seconds'] covers generation + filter + self-tests + repair
    (not the diagnostic hidden grading of every candidate). seconds = t_llm + t_tsc + t_vitest + t_other."""
    t0 = time.time()
    k_n = max(1, int(getattr(a, "tdd_k", N_CAND)))
    use_filter = bool(getattr(a, "tdd_filter", False))
    fast = bool(getattr(a, "tdd_fast", False))
    temps, seeds = cand_plan(k_n)
    type_only, hook = is_type_only(t), is_hook_task(t)
    base = cand_messages(t, fast)
    t_llm = t_tsc = t_vitest = 0.0
    with ThreadPoolExecutor(k_n + len(SUITES)) as ex:
        sf = {s: ex.submit(_chat, a.model, suite_messages(t, s, type_only), 1536, 0) for s in SUITES}
        cf = [ex.submit(gen_candidate, a.model, t, base, temps[k], seeds[k], fast) for k in range(k_n)]
        parsed = {s: parse_suite_n(f.result()["text"], type_only, hook) for s, f in sf.items()}
        suites = {s: p[0] for s, p in parsed.items()}
        outs = [f.result() for f in cf]
    gen_secs = t_llm = time.time() - t0
    codes = [extract_code(o["text"]) for o in outs]

    runs = []
    try:
        bs = batch_score(t, codes, suites, type_only, smoke=use_filter)
        if bs is not None:
            res, counts, lines = bs["res"], bs["counts"], bs["tsc_lines"]
            t_tsc, t_vitest = bs["t_tsc"], bs["t_vitest"]
            feats = ([{"tsc": bs["tsc_n"][k], "missing": missing_exports(t, c), "smoke": bs["smoke"][k]}
                      for k, c in enumerate(codes)] if use_filter else None)
        else:   # a tool timed out: redo candidate by candidate so one hanging candidate costs only itself
            t1 = time.time()
            res, counts, lines, feats = _score_old(t, codes, suites, type_only, use_filter)
            t_vitest = time.time() - t1
        keep = filter_survivors(feats) if use_filter else list(range(k_n))
        sc = score_tests([{k: v[0] for k, v in res[i].items()} for i in keep])

        def tiebreak(j):  # j indexes `keep`: fewer tsc errors, fewer console problems, fewer unhandled, lowest index
            i, c = keep[j], counts[keep[j]]
            return (lines[i], c["err"] + c["warn"], c["unhandled"], i)
        pj, top_tie = pick(sc["scores"], tiebreak)
        picked = keep[pj]
        cand_scores = [None] * k_n
        for j, i in enumerate(keep):
            cand_scores[i] = sc["scores"][j]
        final, info = codes[picked], {}

        # stage 2: one repair turn if the pick fails a test that another candidate passes
        info.update(repair_called=False, repair_kept=False, repaired_passed=None)
        if getattr(a, "tdd_repair", False):
            failing = [(k, res[picked].get(k, (False, "suite crashed"))[1]) for k in sc["keys"]
                       if not res[picked].get(k, (False,))[0] and any(res[i].get(k, (False,))[0] for i in keep)]
            if failing:
                info["repair_called"] = True
                msgs = build_repair(t, base, outs[picked]["text"], failing, suites)
                t1 = time.time()
                out2 = _chat(a.model, msgs, 2048, 0)
                t_llm += time.time() - t1
                code2 = extract_code(out2["text"])
                t1 = time.time()
                run2 = write_run(t, "repair", code2, suites, type_only)
                runs.append(run2)
                res2 = run_selftests(t, run2[0], run2[1], type_only)
                t_vitest += time.time() - t1
                if sum(bool(res2.get(k, (False,))[0]) for k in sc["keys"]) > sc["scores"][pj]:
                    final, info["repair_kept"] = code2, True
        seconds = round(time.time() - t0, 2)
    finally:
        for r in runs:
            shutil.rmtree(r[0], ignore_errors=True)
        shutil.rmtree(KIT / ".runs" / f"tdd--{t['id']}--repair", ignore_errors=True)
        shutil.rmtree(KIT / ".runs" / f"tdd--{t['id']}--batch", ignore_errors=True)

    # diagnostics (hidden tests; excluded from `seconds`)
    cand_hidden = [run_tests_cat(t, c)[0] for c in codes]
    if info["repair_kept"]:
        info["repaired_passed"] = run_tests_cat(t, final)[0]
    toks = sum(o.get("completion_tokens") or 0 for o in outs)
    t_other = round(seconds - t_llm - t_tsc - t_vitest, 2)
    info.update(seconds=seconds, t_llm=round(t_llm, 2), t_tsc=round(t_tsc, 2), t_vitest=round(t_vitest, 2),
                t_other=t_other, fast=fast, n_capped=sum(bool(o.get("capped")) for o in outs),
                tokens_per_sec=round(toks / gen_secs, 1) if gen_secs and toks else None,
                vram_mb=vram_used_mb(), type_only=type_only, suites_ok=[bool(suites[s]) for s in SUITES],
                k=k_n, temps=temps, seeds=seeds, filter=use_filter,
                filtered_out=[i for i in range(k_n) if i not in keep],
                hook_tests_dropped={s: p[1] for s, p in parsed.items()},
                cand_hidden=cand_hidden, cand_scores=cand_scores, picked=picked, top_tie=top_tie,
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
