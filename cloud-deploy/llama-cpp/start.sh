#!/bin/bash
set -e

echo "=== llama.cpp Cloud Run Startup (GPU) ==="

# Llama-2-7B for GPU - larger model with GPU acceleration
MODEL_URL="${MODEL_URL:-https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/main/llama-2-7b-chat.Q4_K_M.gguf}"
MODEL_PATH="/tmp/model.gguf"

echo "Downloading model from: $MODEL_URL"
curl -L -o "$MODEL_PATH" "$MODEL_URL"
echo "Model downloaded: $(ls -lh $MODEL_PATH)"

echo "Starting llama.cpp server with GPU on port 8080..."

# Binary is at /app/llama-server in the official image
# --n-gpu-layers 99 = offload all layers to GPU
exec /app/llama-server \
    --model "$MODEL_PATH" \
    --host 0.0.0.0 \
    --port 8080 \
    --n-gpu-layers 99 \
    --ctx-size 4096 \
    --batch-size 512 \
    --threads 4 \
    --flash-attn
