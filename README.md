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
