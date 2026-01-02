# Cloud Run LLM Deployment Guide

Deploy self-hosted LLMs (llama.cpp or Ollama) on Google Cloud Run.

---

## 🚀 Quick Start

```bash
cd cloud-deploy
./deploy.sh
```

Select option **1** for CPU deployment (works immediately, no GPU quota needed).

---

## 📁 Folder Structure

```
cloud-deploy/
├── deploy.sh           ← Main script (run this!)
├── llama-cpp-cpu/      ← CPU version (tested ✓)
├── llama-cpp/          ← GPU version (needs quota)
└── ollama/             ← Ollama (multi-model)
```

---

## 🔧 How to Change Models

### Method 1: Pass at Deploy Time (Recommended)

No rebuild needed - just set `MODEL_URL`:

```bash
MODEL_URL="https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q4_K_M.gguf" \
./deploy.sh llama-cpu
```

### Method 2: Edit start.sh

1. Edit `llama-cpp-cpu/start.sh`
2. Change the `MODEL_URL` line
3. Run `./deploy.sh llama-cpu` (rebuilds the image)

---

## 📦 Recommended Models

| Model | Size | Speed (CPU) | Use Case |
|-------|------|-------------|----------|
| TinyLlama 1.1B | 600MB | Fast ⚡ | Testing, simple tasks |
| Phi-2 2.7B | 1.6GB | Medium | Coding, reasoning |
| Mistral 7B | 4GB | Slow | General assistant |
| Llama-2 7B | 4GB | Slow | Chat, instruction |

### Model URLs

**TinyLlama (Default):**
```
https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf
```

**Mistral 7B:**
```
https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q4_K_M.gguf
```

**Phi-2:**
```
https://huggingface.co/TheBloke/phi-2-GGUF/resolve/main/phi-2.Q4_K_M.gguf
```

Find more at: https://huggingface.co/models?library=gguf

---

## 🌐 Using the API

After deployment, you get a URL like:
```
https://llama-service-xxxxx.us-central1.run.app
```

### Chat Completion (OpenAI-compatible)
```bash
curl -X POST "YOUR_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 100
  }'
```

### Health Check
```bash
curl "YOUR_URL/health"
```

---

## � Connect to Your Agents

In your agent config:

```typescript
const agentConfig: LLMImplMetadata = {
    type: API_MODEL_TYPE,
    provider: "openai",
    modelID: "llama",
    systemInstruction: "Your prompt here",
    apiKey: "not-needed",
    baseURL: "https://llama-service-xxxxx.us-central1.run.app/v1"
}
```

---

## 🛑 Stop Billing

Delete the service when not using:

```bash
./deploy.sh
# Select option 5 (Delete a service)
```

Or directly:
```bash
gcloud run services delete llama-service --region us-central1 --quiet
```

---

## ❓ Troubleshooting

| Problem | Solution |
|---------|----------|
| "Loading model" error | Wait 1-2 minutes for model to download |
| Timeout on first request | Model is downloading, retry after 2 min |
| Out of memory | Use smaller model or increase `--memory` |
| GPU quota denied | Use CPU version instead |

---

## 📋 Deploy Commands Reference

```bash
# CPU deployment (no quota needed)
./deploy.sh llama-cpu

# GPU deployment (needs quota)
./deploy.sh llama-gpu

# Ollama (multi-model)
./deploy.sh ollama

# With custom model
MODEL_URL="https://..." ./deploy.sh llama-cpu
```
