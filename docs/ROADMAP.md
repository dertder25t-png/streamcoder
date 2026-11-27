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

## Phase A results so far

- **React audit (2026-11-26), 10 failing React tasks, plain 7B:** spec misreads at boundaries or in
  conditional rendering 5, mirrored state instead of derived 2, invented or changed props/types 2,
  wrong DOM event 1. No single React mechanic reaches 4 of 10, so there's no React-rule run.
- **Oracle pass@4 (diagnostic, not a score):** temp-0 single shot 21%. At least one of 4 samples passes
  on 34% (TS 15/35, React 10/35, Node 9/30). Tasks by passing samples (0–4): 66 / 13 / 4 / 6 / 11.
  A perfect picker could add up to +13 pts, and the gate needs +5.
