# MULTI-AGENT AI FRAMEWORK

Multi-agent AI framework is a framework for building multi-agent AI applications.

## Running locally

1. Install Vercel CLI: `npm i -g vercel`
2. Link local instance with Vercel and GitHub accounts (creates `.vercel` directory): `vercel link`
3. Download your environment variables: `vercel env pull`

```bash
pnpm install
pnpm db:migrate # Setup database or apply latest database changes
pnpm dev
```

Your app template should now be running on [localhost:3000](http://localhost:3000).

## Email Agent (Gemini + SMTP)

Environment variables required for the Email Agent:

- `GEMINI_API_KEY` (required)
- `EMAIL_LLM_ENDPOINT` (optional override for Gemini endpoint)
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_SECURE` (`true`/`false`)
- `DEFAULT_FROM`
- `EMAIL_DRY_RUN` (`true` to prevent real sends)

Example prompt:
> "Draft a polite email to alice@example.com asking for a status update, and wait for my confirmation before sending."
+
+## 🚀 Google Colab GPU Backend (Ollama + ngrok)
+
+You can use Google Colab's free GPUs as a high-performance backend for your agents. We use [ngrok](https://ngrok.com/) to expose the Ollama server running in Colab to the internet.
+
+### Setup Instructions
+
+1.  **Get ngrok Auth Token**: Create a free account at [ngrok.com](https://dashboard.ngrok.com/get-started/your-authtoken) and copy your `Authtoken`.
+2.  **Open Colab**: Create a new notebook on [Google Colab](https://colab.research.google.com/).
+3.  **Upload Script**: Upload [colab.py](file:///home/cakir/projects/AI/multi-agent-ai-framework/cloud-deploy/ollama/colab.py) to your Colab environment.
+4.  **Install & Run**: Execute the following in a Colab cell:
+    ```python
+    # Install dependencies
+    !pip install pyngrok
+    !curl -fsSL https://ollama.com/install.sh | sh
+
+    # Run the script (replace NGROK_AUTH_TOKEN in colab.py first or set it here)
+    %run colab.py
+    ```
+5.  **Configure Agents**: Once running, the script will output an API address (e.g., `https://xxxx.ngrok-free.app`).
+    - Copy this URL.
+    - Update the `baseURL` in your agent's configuration (e.g., [config.ts](file:///home/cakir/projects/AI/multi-agent-ai-framework/lib/agents/githubAgent/config.ts)).
+
+> [!TIP]
+> Check the [Quick Links](file:///home/cakir/projects/AI/multi-agent-ai-framework/links.md) for easy access to the ngrok dashboard and other resources.
+
