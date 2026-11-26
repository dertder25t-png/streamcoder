#!/usr/bin/env bash
# Kubuntu setup for StreamCoder: build tools, Vulkan, llama.cpp (Vulkan backend), Node tools, Python venv.
# Run from the project root:  bash setup/install_kubuntu.sh
set -euo pipefail

echo "==> System packages"
sudo apt update
sudo apt install -y build-essential cmake git curl python3-venv python3-pip \
  libvulkan-dev vulkan-tools mesa-vulkan-drivers glslc bolt nodejs npm

echo "==> Node version (need 18+)"
node --version || true

echo "==> Checking the eGPU shows up in Vulkan"
vulkaninfo --summary | grep -i -E "deviceName|driverName" || \
  echo "!! Vulkan doesn't see the GPU. Check the cable, 'boltctl list', then reboot."

echo "==> Building llama.cpp with Vulkan"
if [ ! -d llama.cpp ]; then
  git clone --depth 1 https://github.com/ggml-org/llama.cpp
fi
cmake -S llama.cpp -B llama.cpp/build -DGGML_VULKAN=ON -DCMAKE_BUILD_TYPE=Release
cmake --build llama.cpp/build -j"$(nproc)" --target llama-server llama-cli llama-bench

echo "==> Python environment"
python3 -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -r requirements.txt

echo "==> Eval kit (TypeScript compiler + test runner)"
(cd evalkit && npm install --no-audit --no-fund)

echo "==> Official docs into the library"
python tools/fetch_docs.py
python -m src.library build
python -m src.router train

mkdir -p models
echo
echo "Done. Next:"
echo "  1. Put GGUF models in ./models (see docs/hardware.md)"
echo "  2. python -m src.eval --reference   (should say 9/9 passed)"
echo "  3. Benchmark: ./llama.cpp/build/bin/llama-bench -m models/<file>.gguf -ngl 99"
