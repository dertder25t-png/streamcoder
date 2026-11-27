"""Diagnostics that must NOT land on the stat sheet.
  audit  <ids...>  : plain 7B, current config path (rules + repair), save code + full tsc/vitest output
  oracle           : 4 samples/task (temp 0 + 3x temp 0.6), single shot, grade each -> oracle.jsonl
Run from the repo root (llama-server on :8080):  .venv/bin/python -u tools/diag.py audit react-01 ...
Not on the stat sheet; output goes to results/diag/.
"""
import json, shutil, subprocess, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src import eval as E, llm  # noqa
from src.config import cfg  # noqa

OUT = Path(__file__).resolve().parents[1] / "results" / "diag"; OUT.mkdir(parents=True, exist_ok=True)


def grade_full(t, code):
    run = E.KIT / ".runs" / t["id"]
    if run.exists():
        shutil.rmtree(run)
    run.mkdir(parents=True)
    (run / f"solution{E.ext(t)}").write_text(code)
    for f in E.task_dir(t).glob("solution.test.*"):
        shutil.copy(f, run / f.name)
    E._write_tsconfig(t, run)
    b = E.KIT / "node_modules" / ".bin"
    to = cfg()["eval"]["timeout_seconds"] * 6
    try:
        tsc = E._run([str(b / "tsc"), "-p", str(run / "tsconfig.json")], to)
        if tsc.returncode:
            return False, "TSC\n" + tsc.stdout
        vt = E._run([str(b / "vitest"), "run", f".runs/{t['id']}"], to)
        return vt.returncode == 0, "VITEST\n" + vt.stdout + vt.stderr
    except subprocess.TimeoutExpired:
        return False, "timeout"


def first_pass(t, temp):
    msgs = [{"role": "system", "content": E.SYSTEM}, {"role": "user", "content": E.build_prompt(t)}]
    out = llm.chat("7b", msgs, max_tokens=2048, temperature=temp)
    return msgs, out


def repair(t, msgs, out):
    code = E.extract_code(out["text"])
    errors = E.compile_alone(t, code)
    if not errors:
        return code, out["seconds"]
    lang = "tsx" if t["topic"] == "react" else "ts"
    msgs = msgs + [{"role": "assistant", "content": out["text"]},
                   {"role": "user", "content": "Checking your module (strict TypeScript) found:\n"
                    f"```\n{errors}\n```\nFix these errors. Reply with the full corrected "
                    f"module in one ```{lang} code block."}]
    out2 = llm.chat("7b", msgs, max_tokens=2048, temperature=0)
    return E.extract_code(out2["text"]), out["seconds"] + out2["seconds"]


def tasks():
    return [t for t in E.load_tasks() if t["status"] == "ready"]


def audit(ids):
    d = OUT / "audit"
    d.mkdir(exist_ok=True)
    for t in tasks():
        if not any(t["id"].startswith(i) for i in ids):
            continue
        msgs, out = first_pass(t, 0)
        code, _ = repair(t, msgs, out)
        ok, log = grade_full(t, code)
        (d / f"{t['id']}.tsx").write_text(code)
        (d / f"{t['id']}.log").write_text(log[-6000:])
        print(("PASS" if ok else "FAIL"), t["id"])


def oracle():
    f = (OUT / "oracle.jsonl").open("w")
    for t in tasks():
        res = []
        for temp in (0, 0.6, 0.6, 0.6):
            _, out = first_pass(t, temp)
            ok, _ = grade_full(t, E.extract_code(out["text"]))
            res.append(ok)
        f.write(json.dumps({"id": t["id"], "topic": t["topic"], "passes": res}) + "\n")
        f.flush()
        print(t["id"], res)


if __name__ == "__main__":
    audit(sys.argv[2:]) if sys.argv[1] == "audit" else oracle()
