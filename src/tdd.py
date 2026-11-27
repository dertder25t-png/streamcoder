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
        parsed = {s: parse_suite_n(f.result()["text"], type_only, is_hook_task(t)) for s, f in sf.items()}
        suites = {s: p[0] for s, p in parsed.items()}
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
                hook_tests_dropped={s: p[1] for s, p in parsed.items()},
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
