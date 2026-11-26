# Running several AIs on small hardware

The honest rule: **shrinking a model never makes it smarter by itself.** Quantizing,
pruning and cutting context always cost something. The wins come from the *system*
around the model: sharing memory, splitting jobs, and checking work. The goal is to
make the shrinking cost less than the system gains, then prove it on the stat sheet.

## 1. One brain, many roles (the big VRAM saver)
Loading 4 separate 7B models needs ~18 GB. Loading **one** 7B and giving it 4 parallel
"slots" needs ~4.5 GB for the weights plus a small KV cache per slot.

```bash
llama-server -m models/coder-7b-q4_k_m.gguf -ngl 99 \
  -np 4 -c 16384 -ctk q8_0 -ctv q8_0 --port 8080
#  -np 4      = 4 conversations at once (16384 context is split: 4096 each)
#  -ctk/-ctv  = quantized KV cache, roughly half the memory of the default
```
Each "AI" is the same model with a different system prompt (and later its own LoRA
skill pack). Running them together is usually faster in total than taking turns, because
the GPU works on all slots in one pass.

## 2. Small helpers off the eGPU
Keep the eGPU for the main model and push small jobs elsewhere:
| Helper | Size | Runs on | Job |
|---|---|---|---|
| Router | tiny (scikit-learn) | CPU | which pack, how hard |
| Draft model | 0.5B | eGPU (small) | speculative decoding, ~1.5–2× faster output |
| Checker/summarizer | 0.5–1.5B | CPU or laptop iGPU | summarize long context, sanity-check answers |

If your Framework has the AMD Ryzen chip, its built-in Radeon iGPU also works with
Vulkan, so a second llama-server on the iGPU can host a 1.5B helper. That's a
genuinely free extra "AI". Use `--device` (see `llama-server --list-devices`) to choose the GPU.

## 3. The team loop (where small models gain performance)
For code, the cheapest big quality boost is letting the model **run its code and try again**:
1. **Writer** (7B slot 1) writes the code *and* a few of its own tests.
2. **Runner** (plain Python, not an AI) executes them in a sandbox. Real results, no guessing.
3. **Fixer** (7B slot 2) gets the error message and repairs the code. Repeat up to 3 times.
4. **Reviewer** (optional, slot 3) checks for edge cases the tests missed.

A 7B that gets 3 tries with real error feedback often beats a 14B with one try, and it
fits in your VRAM. In the eval, the fixer may only see errors from the model's **own**
tests, never the hidden eval tests, or the score is cheating.

## 4. Memory checklist (12 GB)
- One base model resident; swap prompts/adapters, never whole models.
- KV cache at q8_0 (try q4_0 and measure the quality hit).
- Context per slot only as big as the job needs: 4k for most code tasks.
- Router + retrieval keep prompts short, which saves both memory and time.
- Per-layer quantization (fragile layers at higher bits) is the experimental bonus.

## 5. How to know it worked
Every one of these is a change, so it gets an eval run with a label and lands on the stat sheet:
`python -m src.eval --model 7b --stream --label "4 slots + fixer loop"` then `python tools/stats.py`.
Keep a change only if pass rate goes up, or stays the same while VRAM or time goes down.
