"""Fast checks that run without a GPU or model: python -m pytest -q"""
import json

from src import library, router
from src.eval import build_prompt, extract_code, load_tasks
from src.prefetch import Prefetcher

PACKS = {"typescript", "react", "node", "general"}


def test_router_returns_known_pack():
    r = router.predict("my useEffect keeps firing twice")
    assert r["pack"] in PACKS
    assert 0 <= r["pack_confidence"] <= 1


def test_library_finds_recipe():
    hits = library.search("type guard for unknown data", ["typescript"])
    assert hits and "type guard" in hits[0]["text"].lower()


def test_prefetch_uses_file_types():
    pf = Prefetcher()
    assert pf.prefetch(files=["src/App.tsx", "src/Button.tsx"])[0] == "react"
    assert pf.prefetch(files=["server.mjs", "package.json"])[0] == "node"


def test_task_file_is_valid():
    tasks = load_tasks()
    assert len(tasks) == 100
    assert len({t["id"] for t in tasks}) == 100
    for t in tasks:
        assert t["topic"] in {"typescript", "react", "node"}
        assert t["difficulty"] in {"easy", "hard"}
        assert t["criteria"], t["id"]
        assert "Requirements:" in build_prompt(t)


def test_no_eval_prompt_leaks_into_router_data():
    seed = {json.loads(l)["text"] for l in open("data/router/seed.jsonl")}
    assert not seed & {t["prompt"] for t in load_tasks()}


def test_extract_code():
    assert extract_code("hi\n```ts\nconst x = 1;\n```\nbye").strip() == "const x = 1;"
    assert extract_code("```tsx\n<A/>\n```").strip() == "<A/>"


def test_categorize():
    from src.eval import categorize
    assert categorize(True, "") is None
    assert categorize(False, "timeout") == "timeout"
    assert categorize(False, "type error: solution.test.ts(1,10): error TS2305: "
                      "Module '\"./solution\"' has no exported member 'debounce'.") == "missing-export"
    assert categorize(False, "type error: solution.test.ts(1,1): error TS2307: "
                      "Cannot find module './solution' or its corresponding type declarations.") == "missing-export"
    assert categorize(False, "type error: solution.ts(5,3): error TS2322: "
                      "Type 'string' is not assignable to type 'number'.") == "type-error"
    assert categorize(False, "test failed: TypeError: debounce is not a function") == "missing-export"
    assert categorize(False, "test failed: Error: Element type is invalid: expected a string") == "missing-export"
    assert categorize(False, "test failed: AssertionError: expected 3 to be 4") == "test-fail"
    # bad imports inside the solution are type errors, not missing exports
    assert categorize(False, "type error: .runs/x/solution.ts(1,22): error TS2305: Module '\"node:crypto\"' "
                             "has no exported member 'createHasher'.") == "type-error"
    assert categorize(False, "type error: .runs/x/solution.ts(1,27): error TS2307: Cannot find module "
                             "'lodash' or its corresponding type declarations.") == "type-error"
