"""Check one eval task while writing it (works for todo tasks too).

  python tools/check_task.py <task-id> [--buggy file ...]

Grades data/eval/tasks/<id>/reference.* (must PASS) and each --buggy file (must FAIL)
with the same tsc + vitest harness as src.eval. Exit code 0 only if all expectations hold.
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.eval import load_tasks, run_tests, task_dir  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("task_id")
    ap.add_argument("--buggy", nargs="*", default=[])
    a = ap.parse_args()
    t = next((t for t in load_tasks() if t["id"] == a.task_id), None)
    if t is None:
        sys.exit(f"unknown task id: {a.task_id}")
    ok = True
    ref = next(task_dir(t).glob("reference.*"), None)
    if ref is None:
        sys.exit("no reference file")
    passed, err = run_tests(t, ref.read_text())
    print(f"reference: {'PASS' if passed else 'FAIL ' + err}")
    ok &= passed
    for b in a.buggy:
        passed, err = run_tests(t, Path(b).read_text())
        print(f"buggy {Path(b).name}: {'FAIL (good) ' + err if not passed else 'PASS (bad: tests miss this bug)'}")
        ok &= not passed
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
