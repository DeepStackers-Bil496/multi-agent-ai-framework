# llama.cpp Cloud Run Dockerfile - CPU Only
# Tested and working on Google Cloud Run

FROM ghcr.io/ggml-org/llama.cpp:server

ENV MODEL_PATH=/tmp/model.gguf
ENV HOST=0.0.0.0
ENV PORT=8080

WORKDIR /app

# Install curl for downloading models
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 8080

ENTRYPOINT ["/bin/bash", "/app/start.sh"]
