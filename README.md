# StreamCoder

A local coding assistant for **TypeScript, React and Node**, built like a video game engine:
a small model stays loaded on the GPU, and knowledge is **streamed in only when it's needed**,
the way a game streams textures for the room you're walking into.

**Goal:** make a 7B model code close to a 14B, while staying faster and using about half the
VRAM, on a Framework laptop + RX 6700 XT eGPU (12 GB) running Kubuntu.

**How:** we don't retrain the model. It's an open-book exam:
- **Model** = the student (frozen, runs in llama-server on the GPU)
- **Library** = the open book (hand-written recipes + official docs)
- **Router** = a tiny classifier that picks which chapter to open (the only thing we train)
- **Eval** = the exam (100 questions with hidden tests)

```
 your question + open files
          │
          ▼
 Router (CPU) ── "React, hard, 0.83 sure"
          │
          ▼
 Prefetcher ── keeps the right pack warm in RAM, switches LoRA later
          │
          ▼
 Library search ── top recipes/docs from that pack only (weak matches dropped)
          │
          ▼
 llama-server (GPU, Vulkan) ── 7B answers with the notes in front of it
```

**Hardware rule:** the eGPU cable is ~100× slower than the card's own memory. The model loads
once and stays put; only text (and later small LoRA files) move across the cable.

## Status

| Part | State |
|---|---|
| Router | Works. 178 examples (62 real Stack Overflow posts), ~79% accuracy |
| Library | Works. Recipes for TS/React/Node + official docs (React, TS Handbook, Node API) |
| Eval | 100 questions merged and cleaned. **9 ready** (tests + reference, verified). **91 todo** |
| Stat sheet | Works. Baselines, change log, "gap closed vs 14B", VRAM, speed |
| Pipeline / prefetch | Works end to end (tested against a fake server) |
| LoRA skill packs, speculative decoding, team loop | Later phases |

## Phases

| # | What | Runs on |
|---|---|---|
| 0 | Setup: llama.cpp (Vulkan), Node, evalkit, docs. Benchmark speed | GPU |
| 1 | Finish eval tasks (tests + reference for all 100) | CPU |
| 2 | Baselines: plain 7B and plain 14B | GPU |
| 3 | 7B + StreamCoder (router + library). Compare: **gap closed** | GPU |
| 4 | Improve retrieval: tune `min_score`, better recipes, try a small embedding model | CPU |
| 5 | Prefetch from open files; team loop (write → run → fix) on shared slots | GPU |
| 6 | Speculative decoding (0.5B draft), per-layer quant tests | GPU |
| 7 | LoRA skill packs per topic (likely trained on a rented GPU) | cloud/GPU |

## Quick start

```bash
bash setup/install_kubuntu.sh        # system packages, llama.cpp, Node tools, Python venv
source .venv/bin/activate
python tools/fetch_docs.py           # official docs into the library
python -m src.router train
python -m src.library build
python -m src.eval --reference       # all ready tasks must pass
python -m pytest -q
```

With llama-server running (see `docs/hardware.md`):

```bash
python -m src.eval --model 7b  --label baseline --model-file coder-7b-q4_k_m.gguf
python -m src.eval --model 14b --label baseline --model-file coder-14b-q4_k_m.gguf   # restart server with 14B first
python -m src.eval --model 7b --stream --label "router + library v1"
python tools/stats.py                # -> stats/STAT_SHEET.md
```

## The eval (data/eval/)

- `tasks.jsonl`: 100 tasks (35 TypeScript, 35 React, 30 Node; 60 easy, 40 hard).
  Merged from the teacher/student PDF and question file; famous public puzzles,
  duplicates and ungradable ones removed.
- `status: "ready"` tasks have `tasks/<id>/reference.ts(x)` + `solution.test.ts(x)`.
- Grading = `tsc` strict type check + hidden `vitest` tests, in `evalkit/`.
- The model sees prompt + requirements. Never the tests or the reference.
- 22 tasks are "Fix …" tasks: they need a `broken_code` field (see ts-06 for an example).
- `docs/QUESTION_TEMPLATE.md` is the format for new questions from teachers/students.

## Data and licenses
See `data/library/SOURCES.md`. Book scans (if any) go in `data/books/` and are never committed.

## Folders
- `src/` router, library, prefetch, pipeline, eval, llm client
- `tools/` fetch_docs, stats, grow_router_data, ingest_books
- `evalkit/` Node project that grades answers (tsc + vitest)
- `data/router/` router training data · `data/library/<pack>/` recipes + docs · `data/eval/` the exam
- `stats/` run history (`runs.jsonl`) and the generated stat sheet
- `docs/` hardware notes, multi-model plan, question template, Claude Code start prompt
