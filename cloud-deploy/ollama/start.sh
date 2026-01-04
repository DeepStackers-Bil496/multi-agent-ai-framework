#!/bin/bash
set -e

echo "=== Ollama Cloud Run Startup ==="

# Use the pre-baked model directory
export OLLAMA_MODELS=/root/.ollama/models
export HOME=/root

# Default model (should already be pre-baked in the image)
OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.2:3b-instruct-q4_K_M}"

echo "Starting Ollama server..."
ollama serve &
OLLAMA_PID=$!

# Wait for Ollama to be ready
echo "Waiting for Ollama to start..."
MAX_WAIT=30
for i in $(seq 1 $MAX_WAIT); do
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "Ollama is ready!"
        break
    fi
    echo "Waiting... ($i/$MAX_WAIT)"
    sleep 1
done

# Check if model exists, only pull if missing
MODELS=$(curl -s http://localhost:11434/api/tags | grep -o "\"name\":\"[^\"]*\"" | head -1 || echo "")
if [ -z "$MODELS" ]; then
    echo "No models found, pulling: $OLLAMA_MODEL"
    ollama pull "$OLLAMA_MODEL" || echo "Warning: Failed to pull model"
else
    echo "Pre-baked model found: $MODELS"
fi

echo "Ollama server is running on port 11434"
ollama list

# Keep server running
wait $OLLAMA_PID
