# StreamCoder: notes for Claude Code

Keep token use low: read only the files a task needs, prefer small diffs, no long recaps.

- Goal, status, phases: README.md. Hardware/runtime: docs/hardware.md. Multi-AI plan: docs/multi-model.md.
- Stack under test: TypeScript, React, Node. Packs: typescript, react, node, general.
- Python 3.11+ (`python -m src.<name>`). Eval grading lives in evalkit/ (Node: tsc + vitest).
- Router (TF-IDF) and library are CPU-only on purpose. The library uses nomic-embed-text on a CPU llama-server
  (`setup/embed_server.sh`, port 8081), which must be running for `--stream` runs.
- LLM calls go to llama-server's OpenAI-compatible API (config.yaml `models`). Never load models in Python.
- Base model stays resident on the eGPU; only text and LoRA adapters get swapped (slow Thunderbolt link).
- GPU: always pass `--device Vulkan1` (the RX 6700 XT; Vulkan0 is the Intel iGPU). Eval runs use temperature 0.
- Plan, current status and the next step: docs/ROADMAP.md (currently Phase A step 3, blind TDD + best-of-4).
- Checks: `python -m pytest -q` and `python -m src.eval --reference` (every ready task must pass).

## Standing rules from the user
- Don't change the SYSTEM prompt in src/eval.py.
- Never put eval tests or solutions in the library or router data. Never invent benchmark numbers.
- Ask before downloading anything over 1 GB.
- Latency budget: stay under the 14B's 21 s/task.
- One labeled run per change, short result tables, commit and push after each.
- Diagnostics (React audit, oracle pass@N via tools/diag.py) are never scores and stay off the stat sheet.

## Frozen eval and final exam (see docs/ROADMAP.md)
- The 100 tasks in data/eval/ and their tests are FROZEN. Don't edit them; ask the user first if one looks broken.
- `data/final_exam/` (added later): never open, read, run or tune on it until the user says so.

## Eval rules
- A task becomes `status: "ready"` only when `data/eval/tasks/<id>/` has `reference.ts(x)` and
  `solution.test.ts(x)`, the reference passes, AND at least one plausible buggy version fails.
- Tests import from "./solution". React tests start with `// @vitest-environment jsdom`.
- Test only what the task's criteria state. Don't require extra exports or exact markup beyond them.
- "Fix" tasks need a `broken_code` field in tasks.jsonl (realistic bug matching the description).
- Never show tests or references to the model. Never put eval solutions in the library or router data.

## Stat sheet rules (always)
- Each base model gets a `--label baseline` plain run BEFORE any change is measured.
- After any change that can affect output, speed or memory: run eval with `--label "<what changed>"`, then `python tools/stats.py`.
- Never claim an improvement without a row in stats/runs.jsonl. Report: pass rate vs baseline, gap closed vs 14B, sec/task, VRAM.
- Keep a change only if pass rate rises, or holds while time or VRAM drops. Otherwise revert it and log why.
- stats/category.yaml: only published numbers with a source link. Never invent scores.
