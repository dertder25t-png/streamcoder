# StreamCoder roadmap

Every change gets one labeled eval run, a short table, and a commit. A change is kept only if the
stat sheet says it helped (see CLAUDE.md "Stat sheet rules"). Latency budget: stay under the plain
14B's 21 s/task.

## Phase A: self-checking instead of retrieval tuning

Starts after the export-check runs finish. No more retrieval tuning.

1. **React audit.** Open the vitest logs for 10 failing React tasks from the plain 7B run, group the
   failures by cause, and report. If one mechanical cause dominates, test a short React rule as its
   own run.
2. **Oracle pass@4** (diagnostic only, never reported as a score). 4 samples per task (1 at temp 0,
   3 at temp 0.6). Count the tasks where at least one sample passes the hidden tests. This shows the
   ceiling for best-of-N.
3. **Blind TDD + best-of-4.**
   - The model writes 4–5 vitest tests from the prompt alone, BEFORE generating code.
   - Generate 4 samples and drop any that fail tsc.
   - Rank the rest by self-test passes; tie-break on agreement between samples.
   - Allow up to 2 repair rounds on self-test failures.
4. **Post-mortem retrieval.** Pass 1 gets no references. Only on a tsc or self-test failure, search
   with the error message plus the failing line, and add one chunk to the repair prompt.

**Gate:** +5 pts over the plain 7B with the same prompt.

## Phase B: hazard checklists

Checklists of 4–6 bullets for these mechanic classes: concurrency-race, stream-and-encoding,
effect-cleanup, prototype-safety, strict-ts-types, a11y-focus, parser-escaping and
immutable-recursion. Write them from general knowledge, without reading the eval tasks, and
retrieve them by error during repair.

**Gate:** +3 pts over Phase A.

## Phase C: speed

- Speculative decoding with the 0.5B draft model.
- Self-test generation on the Intel Arc iGPU (Vulkan0).
- Tune N to stay under the 14B's 21 s/task.
- Run the best setup on the 14B too.

## Phase D: auditor pass

The model is asked to "find the 3 most likely bugs", with the self-test results attached.

## Phase E: training (later, on a rented GPU)

LoRA/DPO trained on our own pass/fail samples from synthetic tasks, never from eval tasks.

## Stop rule

If two phases in a row gain less than +3 pts, pivot to a benchmark project.

## Final exam and frozen eval

- **Final exam:** a separate set of about 30 new questions written by my teacher, added later as
  `data/final_exam/`. Never open, run or tune on it until I say so. It runs once, at the very end.
- **The 100 eval tasks and their tests are frozen.** Edits would break comparisons with the
  baselines. If a task looks broken, ask first.

## Status (2026-11-26)

**Next step: Phase A step 3, blind TDD + best-of-4.** Steps 1–2 are done. Everything below is from
stats/runs.jsonl (run #) or from scratchpad diagnostics that are not on the stat sheet.

### Baselines (plain prompt, temp 0, 100 frozen tasks)
| Model | Pass | Sec/task | VRAM |
|---|---|---|---|
| 7B Q4_K_M (#6) | 20% | 8.4 | 4,732 MB |
| 14B Q4_K_M (#7) | 41% | 15.9 | 9,296 MB |
| 14B + format rules + repair (#14, the target to compare with) | 42% | 21.0 | 9,304 MB |

### Changes tried (7B)
| Change | Runs | Result | Decision |
|---|---|---|---|
| Router + library v1 (TF-IDF) | #8 | 15% | baseline for stream |
| Recipes only, no docs | #9 | 15% | reverted (no gain) |
| Format rules at end of prompt | #10–11 | plain 21%, stream 17% | **kept** |
| One tsc repair retry (solution compiled alone, no tests) | #12–13 | plain 22%, stream 19% | **kept** |
| Route/search on first paragraph only | #15 | 19% | reverted |
| Embedding search (nomic v1.5, CPU), min_score 0.91 | #16 | stream 21% | **kept** |
| Raw-score gate 0.61 + top-1 chunk | #17 | 19% | reverted |
| Missing-export check in repair | #18–19 | plain 22% (slower), stream 22% at 21.4 s | reverted |
| Blind TDD best-of-4, stage 1 pick-best (`--tdd`, -np 4) | #20 | 26% at 32.2 s/task, 4,976 MB | over latency budget; flag off by default |

Stage 1 picker (run #20): in-run oracle 38%, picker accuracy 68% (TS 85, React 58, Node 62),
top-score tie 86%, self-tests 0/4 = 60% (React 91%), 4/4 = 19%. All 12 missed tasks lost on a
tie-break, none on self-test score: the self-tests rarely separate candidates.

Stage 2, + one repair turn (run #21): 33% at 30.5 s/task, 4,978 MB. The repair was called on only 2
tasks and kept 0 times, so run #21 used the same pipeline as #20. The 26 -> 33 gap is sampling noise
at temp 0.7, which means a single best-of-4 run has about ±4 pts of noise. Picker accuracy 87%,
top tie 80%, 5 tie-break misses. Repair rarely runs because the pick almost never fails a test that
another candidate passes (ties dominate). Both runs are over the 21 s/task budget; `--tdd` stays off by default.

Current best: **plain 7B + format rules + repair = 22% at ~12 s/task**. The stream setup is not better
than plain, so retrieval tuning has stopped. Retrieval only comes back as post-mortem retrieval (step 4).

### Diagnostics (not scores)
- **Speed check:** a slow run 19 (24 tok/s instead of ~36) was not caused by the embedding server
  (llama-bench shows the same speed with it stopped, idle or busy). The run script now benches before
  each eval. Details: docs/hardware.md.
- **React audit (10 failing tasks):** spec misreads at boundaries or in conditional rendering 5,
  mirrored state instead of derived 2, invented or changed props/types 2, wrong DOM event 1. No React
  mechanic reaches 4 of 10, so there's no React-rule run. Soft spot: the react-06 prompt doesn't say the
  component takes no props (the eval is frozen, so that's the user's call).
- **Oracle pass@4** (single shot, temp 0 + 3 at temp 0.6, no repair): temp 0 = 21%, any of 4 = **34%**
  (TS 15/35, React 10/35, Node 9/30). Tasks by passing samples (0–4): 66 / 13 / 4 / 6 / 11. A perfect
  picker could add up to +13 pts, and the gate needs +5. Script: tools/diag.py (audit | oracle).

### Blind TDD plan details (to start)
- The model writes 4–5 vitest tests from the prompt only. It never sees the hidden tests or references.
- 4 samples (temp 0 + 3 at 0.6), drop tsc failures, rank by self-test passes, tie-break on agreement,
  up to 2 repair rounds. Compare with plain 7B + rules + repair (22%). Latency must stay under 21 s/task.

### Offline picker comparison (frozen best-of-4, fixed harness; diagnostic, not a stat-sheet score)
Frozen oracle 29/100 (TS 13, React 7, Node 9). Capture = picked passes / oracle tasks.
| Picker | Pass | Capture | TS | React | Node | Top tie |
|---|---|---|---|---|---|---|
| cand0 (temp 0 only) | 20% | 69% | 11/13 | 5/7 | 4/9 | n/a |
| self-test count | **25%** | **86%** | 12/13 | 7/7 | 6/9 | 73% |
| CodeT clusters | 23% | 79% | 12/13 | 6/7 | 5/9 | 85% |
| MBR-Exec | 23% | 79% | 12/13 | 6/7 | 5/9 | 88% |
| zero-LLM filter only | 22% | 76% | 12/13 | 6/7 | 4/9 | 84% |
| filter + self-test | **25%** | **86%** | 12/13 | 7/7 | 6/9 | 65% |
MBR is weak because every probe errors for every candidate on 24 tasks (mostly React). The filters never
dropped a hidden-passing candidate. Next: 8-candidate freeze (data/frozen8) for best-of-4 vs best-of-8.
