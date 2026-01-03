#!/bin/bash
set -e

echo "=== llama.cpp Cloud Run Startup (CPU) ==="

# TinyLlama for CPU - small and efficient (~600MB)
# For larger models, change this URL
#"https://huggingface.co/mradermacher/GPT-NeoX-20B-Erebus-GGUF/resolve/main/GPT-NeoX-20B-Erebus.Q4_K_M.gguf" 
MODEL_URL="${MODEL_URL:-https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf}"
MODEL_PATH="/tmp/model.gguf"

echo "Downloading model from: $MODEL_URL"
curl -L -o "$MODEL_PATH" "$MODEL_URL"
echo "Model downloaded: $(ls -lh $MODEL_PATH)"

echo "Starting llama.cpp server on port 8080..."

# Binary is at /app/llama-server in the official image
exec /app/llama-server \
    --model "$MODEL_PATH" \
    --host 0.0.0.0 \
    --port 8080 \
    --ctx-size 65536 \
    --threads 8
