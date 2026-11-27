# Hardware notes: Framework + RX 6700 XT eGPU on Kubuntu

## The card
- RX 6700 XT: 12 GB VRAM, RDNA2 (chip id `gfx1031`).
- ROCm doesn't officially support it. It usually works with
  `export HSA_OVERRIDE_GFX_VERSION=10.3.0`, but that can break between versions.
- **Start with llama.cpp's Vulkan backend.** It uses the normal Mesa (RADV) driver,
  needs no ROCm and is often about as fast on RDNA2. Try ROCm later only if you want to compare.

## The eGPU link
- Thunderbolt/USB4 carries roughly 3–4 GB/s at best, versus 380+ GB/s inside the card.
- Loading a 4.5 GB model takes a couple of seconds, so load it once at startup.
- Once the model is in VRAM, generation speed is barely affected by the cable.
- Swapping a LoRA adapter (~20–150 MB) or sending text is cheap. That's why the design streams those.
- Check the link is working: `boltctl list` (authorized) and `vulkaninfo --summary` (card shows up).

## VRAM budget (12 GB)
| Thing | Approx. size |
|---|---|
| 7B coder, Q4_K_M | ~4.5 GB |
| 14B coder, Q4_K_M | ~9 GB |
| 0.5B draft model, Q8 | ~0.5 GB |
| KV cache, 8k context, q8_0 | ~0.5–1 GB (7B) |
| 2–3 LoRA adapters | ~0.1–0.4 GB |

So 7B + draft + adapters + long context fits easily, and plain 14B fits for comparison runs.
Both at once doesn't fit, so run them one at a time.

## Models to try (check for newer versions first)
- Main: a 7B coder instruct model in GGUF, e.g. Qwen2.5-Coder-7B-Instruct Q4_K_M.
- Comparison: the 14B version of the same family.
- Draft for speculative decoding: the 0.5B version of the same family (must share the tokenizer).

## Measured speed (llama-bench)
2026-11-26, llama.cpp `0ac39e4`, Vulkan, `-ngl 99 -dev Vulkan1 -r 3`, defaults pp512 / tg128.
Vulkan0 is the laptop's Intel Arc B390 iGPU. Always pass `--device Vulkan1` (the 6700 XT),
or llama.cpp splits layers across both GPUs.

| Model (Qwen2.5-Coder Instruct) | File size | Prompt pp512 (tok/s) | Generate tg128 (tok/s) |
|---|---:|---:|---:|
| 0.5B Q8_0 (draft) | 639 MiB | 7723.8 ± 11.2 | 165.1 ± 8.1 |
| 7B Q4_K_M | 4.36 GiB | 789.1 ± 1.1 | 43.0 ± 0.3 |
| 14B Q4_K_M | 8.37 GiB | 396.0 ± 0.0 | 23.4 ± 0.1 |

## Running llama-server
```bash
# 7B, all layers on GPU, quantized KV cache, port 8080
./llama.cpp/build/bin/llama-server -m models/qwen2.5-coder-7b-instruct-q4_k_m.gguf \
  --device Vulkan1 -ngl 99 -c 8192 -ctk q8_0 -ctv q8_0 --port 8080

# later: + draft model for speculative decoding
#   -md models/qwen2.5-coder-0.5b-instruct-q8_0.gguf -ngld 99 -devd Vulkan1
# later: + LoRA skill packs loaded but off, switched by src/prefetch.py
#   --lora data/adapters/python.gguf --lora data/adapters/web.gguf --lora-init-without-apply
```
Flag names change between llama.cpp versions. Check `llama-server --help` if one fails.

## Training reality check
Fine-tuning a 7B (QLoRA) on a 12 GB AMD card is possible but fiddly, because many
training tools assume NVIDIA. Options:
1. Phases 2–5 need no training at all except the CPU router. Do these first.
2. Train LoRA adapters on a 1.5B model locally to learn the process.
3. Rent a cloud GPU for an hour or two to train 7B adapters, then run them locally.

## Speed check after the slow run 19 (2026-11-26)

Run 19 (stream, export check) ran at 21–27 tok/s instead of the usual ~36. Run 18's second half had
already slowed (36.5 -> 32.4 tok/s). llama-bench, 7B Q4_K_M, Vulkan1, 3 reps:

| Condition | pp512 t/s | tg128 t/s |
|---|---|---|
| Embedding server stopped | 769 | 42.2 |
| Embedding server running, idle | 787 | 42.9 |
| Embedding server busy (embedding loop) | 784 | 42.6 |

- The embedding server is **not** the cause (<1% effect), so its thread count (-t 8) stays as it is.
- Power: ACPI platform profile `performance`, CPU governor `powersave` with EPP `balance_performance`,
  on AC power. GPU power level `auto`. (`powerprofilesctl` isn't installed.)
- Temps: GPU junction 50–63 °C (fine). CPU package 67 °C idle, 90 °C under the embedding load.
- No amdgpu, Thunderbolt or thermal messages in the kernel log for that time.
- Likely cause: a temporary slowdown during that session (heat, or other load on the laptop). It
  could not be reproduced. Guard: the run script now records a quick tg128 bench before each eval, so a
  slow machine shows up before the numbers get blamed on a change.
