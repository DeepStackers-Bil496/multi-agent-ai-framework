# Ollama Cloud Run Dockerfile
# Pre-bakes the model into the image for instant startup

FROM ollama/ollama:latest

ENV OLLAMA_HOST=0.0.0.0
ENV OLLAMA_MODELS=/root/.ollama/models
ENV HOME=/root

# Model to pre-bake (change this to use a different model)
ARG OLLAMA_MODEL=llama3.2:3b-instruct-q4_K_M

# Create model directories
RUN mkdir -p /root/.ollama/models

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Pre-bake the model: Start Ollama, pull the model, then stop
RUN ollama serve & \
    sleep 5 && \
    ollama pull ${OLLAMA_MODEL} && \
    pkill ollama

COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 11434

ENTRYPOINT ["/bin/bash", "/app/start.sh"]
