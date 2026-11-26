# Starter prompt for Claude Code

Paste this into Claude Code from the project folder:

---

I'm building StreamCoder, a local coding assistant for TypeScript/React/Node. Read README.md and CLAUDE.md first and nothing else until a step needs it. Keep token use low: small diffs, short reports, no recaps of files you just read.

My hardware: Framework laptop, Kubuntu, AMD RX 6700 XT (12 GB) in an AOOSTAR EG02 eGPU dock over Thunderbolt/USB4. llama.cpp uses the Vulkan backend (not ROCm).

Work through these steps in order. Stop after each step, show me a short summary and wait for my OK before going on.

1. **Setup check.** Run `git init` and make a first commit. Show me the commands from `setup/install_kubuntu.sh` that need sudo and let me run them myself. Then confirm: `vulkaninfo --summary` shows the 6700 XT, `python -m pytest -q` passes, and `python -m src.eval --reference` says 9/9.

2. **Models.** Search for the current best coder instruct models in GGUF at about 7B and 14B (same family, plus a 0.5B draft model if one exists). Tell me the file names and sizes before downloading anything. After I approve, download Q4_K_M versions to `models/`, run `llama-bench` on each with `-ngl 99`, and record tokens/sec in `docs/hardware.md`.

3. **Finish the eval.** Turn the 91 `todo` tasks in `data/eval/tasks.jsonl` into `ready` tasks in batches of about 10, following the eval rules in CLAUDE.md exactly. Use the 9 ready tasks as the pattern. For every task, prove the reference passes and a plausible buggy version fails. Fix tasks need a realistic `broken_code`. If a task's criteria can't be tested reliably, don't force it: list it for me with a suggested rewrite. Commit after each batch.

4. **Baselines.** Run the plain 7B and plain 14B with `--label baseline`, then the 7B with `--stream --label "router + library v1"`. Run `python tools/stats.py` and tell me the gap closed, speed and VRAM.

5. **First improvement.** Based on the failures, propose up to 3 changes (for example the `min_score` cutoff, better recipes for the weakest topic, or an embedding model for search). Make one at a time, measure each with a labeled eval run, and keep it only if the stat sheet says it helped.

Rules: never put eval tests or solutions in the library or router data, never invent benchmark numbers, and ask before downloading anything over 1 GB.

---
