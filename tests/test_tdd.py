"""Pure-logic checks for src/tdd.py (no model, no node needed): python -m pytest -q"""
from src import tdd
from src.eval import load_tasks

T_REACT = {"id": "r-1", "topic": "react", "prompt": "Export `Counter` component.", "must_export": "`Counter`"}
T_NODE = {"id": "n-1", "topic": "node", "prompt": "x", "must_export": "`readAll`, `writeAll`"}


def test_is_type_only_selects_only_pure_type_tasks():
    sel = [t["id"] for t in load_tasks() if t["status"] == "ready" and tdd.is_type_only(t)]
    assert sel == ["ts-33-deep-partial-except-specific-keys"]


def test_parse_suite_strips_imports_and_hooks():
    reply = ("- adds one\n```ts\nimport { x } from './solution';\nimport {\n a,\n b } from \"vitest\";\n"
             "afterEach(() => {\n  cleanup();\n});\n\ntest(\"adds\", () => {\n  expect(1).toBe(1);\n});\n```")
    body = tdd.parse_suite(reply, False)
    assert "import" not in body and "afterEach" not in body and 'test("adds"' in body


def test_parse_suite_rejects_prose_and_testless_code():
    assert tdd.parse_suite("no code here, test(1)", False) == ""
    assert tdd.parse_suite("```ts\nconst a = 1;\n```", False) == ""


def test_parse_suite_typecheck_drops_model_helpers():
    reply = "```ts\ntype Expect<T extends true> = T;\ntype A = Expect<Equal<1, 1>>;\n```"
    body = tdd.parse_suite(reply, True)
    assert "type Expect<T" not in body and "type A = Expect<" in body


def test_header_react_and_node():
    h = tdd.test_header(T_REACT, "/x/c.json")
    assert h.startswith("// @vitest-environment jsdom") and 'import { Counter } from "./solution"' in h
    assert "cleanup(); vi.useRealTimers()" in h and '"/x/c.json"' in h
    n = tdd.test_header(T_NODE, "/x/c.json")
    assert 'import fs from "node:fs"' in n and "cleanup()" not in n and "readAll, writeAll" in n
    assert "import * as S" in tdd.test_header({**T_NODE, "must_export": None, "prompt": "do it"}, "c")


def test_score_excludes_zero_of_four_tests():
    oks = [{"a::t1": True, "a::t2": False, "a::t3": False},
           {"a::t1": True, "a::t2": True, "a::t3": False},
           {"a::t1": False, "a::t2": False},          # t3 missing counts as failed
           {"a::t1": True, "a::t2": False, "a::t3": False}]
    s = tdd.score_tests(oks)
    assert s["scores"] == [1, 2, 0, 1] and s["n_zero"] == 1 and s["n_all"] == 0 and s["n_tests"] == 3


def test_score_all_pass_counts():
    s = tdd.score_tests([{"a::x": True}] * 4)
    assert s["n_all"] == 1 and s["scores"] == [1, 1, 1, 1]


def test_pick_tiebreak_order():
    tb = {0: (3, 0, 0, 0), 1: (1, 5, 0, 1), 2: (1, 2, 4, 2), 3: (1, 2, 1, 3)}
    assert tdd.pick([2, 2, 2, 2], tb.get) == (3, True)   # fewest tsc, then warnings, then unhandled
    assert tdd.pick([1, 3, 3, 2], lambda i: (0, 0, 0, i)) == (1, True)  # lowest index
    assert tdd.pick([1, 3, 2, 2], lambda i: (0, 0, 0, i)) == (1, False)


def test_miss_reason():
    assert tdd.miss_reason([3, 1, 1, 1], 0, [False, True, False, False]) == "self-test"
    assert tdd.miss_reason([3, 3, 1, 1], 0, [False, True, False, False]) == "tie-break"
    assert tdd.miss_reason([3, 1, 1, 1], 0, [True, True, False, False]) is None
    assert tdd.miss_reason([3, 1, 1, 1], 0, [False] * 4) is None


def test_typecheck_line_mapping():
    text = "H1\nH2\ntype A = Expect<Equal<X, Y>>;\n// @ts-expect-error\nconst z: X = 1;\ntype B = Expect<\n  Equal<P, Q>>;\n"
    names = [n for _, _, n in tdd.typecheck_tests(text)]
    assert len(names) == 3
    ok = tdd.grade_typecheck(text, 2, [])
    assert all(ok.values())
    bad = tdd.grade_typecheck(text, 2, [(3, "TS2344"), (4, "TS2578"), (7, "TS2344")])
    assert list(bad.values()) == [False, False, False]  # A fails, directive unused (@ line 4), B (line 6-7) fails
    one = tdd.grade_typecheck(text, 2, [(5, "TS2322")])  # error on line after the directive is not a test line
    assert all(one.values())
    assert not any(tdd.grade_typecheck(text, 2, [(1, "TS2305")]).values())  # missing export fails all
