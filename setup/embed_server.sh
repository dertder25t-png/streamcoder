#!/usr/bin/env bash
# CPU-only embedding server for library search (config.yaml library.backend: embed).
# Runs beside the GPU coder server; uses port 8081. Model: nomic-embed-text-v1.5 (Q8_0, ~146 MB).
# Download: https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF -> models/
# The model's max input is 2048 tokens; src/library.py trims long chunks before embedding.
cd "$(dirname "$0")/.."
exec ./llama.cpp/build/bin/llama-server -m models/nomic-embed-text-v1.5.Q8_0.gguf \
  --embeddings --pooling mean --device none -ngl 0 --port 8081 \
  -c 8192 -np 4 -b 2048 -ub 2048 -t 8
