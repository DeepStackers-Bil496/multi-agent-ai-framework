# llama.cpp Cloud Run Dockerfile - GPU (CUDA)
# Requires GPU quota on Cloud Run

FROM ghcr.io/ggml-org/llama.cpp:server-cuda

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
