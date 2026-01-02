#!/bin/bash
set -e

echo "=== Ollama Cloud Run Startup ==="

# Ensure writable directories
mkdir -p /tmp/ollama/models /tmp/.ollama
export HOME=/tmp
export OLLAMA_MODELS=/tmp/ollama/models

# Default model to pull
OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.2:1b}"

echo "Starting Ollama server..."
ollama serve &
OLLAMA_PID=$!

# Wait for Ollama to be ready
echo "Waiting for Ollama to start..."
MAX_WAIT=60
for i in $(seq 1 $MAX_WAIT); do
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "Ollama is ready!"
        break
    fi
    echo "Waiting... ($i/$MAX_WAIT)"
    sleep 1
done

# Pull the model
echo "Pulling model: $OLLAMA_MODEL"
ollama pull "$OLLAMA_MODEL" || echo "Warning: Failed to pull model"

echo "Ollama server is running on port 11434"
echo "Model: $OLLAMA_MODEL"

# Keep server running
wait $OLLAMA_PID
