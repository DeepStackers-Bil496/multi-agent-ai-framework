# Ollama Cloud Run Dockerfile
# For easy model management with Ollama

FROM ollama/ollama:latest

ENV OLLAMA_HOST=0.0.0.0
ENV OLLAMA_MODELS=/tmp/ollama/models
ENV HOME=/tmp

# Create writable directories (Cloud Run filesystem is read-only except /tmp)
RUN mkdir -p /tmp/ollama/models /tmp/.ollama

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 11434

ENTRYPOINT ["/bin/bash", "/app/start.sh"]
