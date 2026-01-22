# MULTI-AGENT AI FRAMEWORK

Multi-agent AI framework is a framework for building multi-agent AI applications.

## Running locally

1. Install Vercel CLI: `npm i -g vercel`
2. Link local instance with Vercel and GitHub accounts (creates `.vercel` directory): `vercel link`
3. Download your environment variables: `vercel env pull`

```bash
pnpm install
pnpm db:migrate # Setup database or apply latest database changes
```

### Option A: Run app only

```bash
pnpm dev
```

### Option B: Run app + TTS (single terminal)

Install the Python deps once:

```bash
python -m pip install -r requirements.txt
```

Then run both the Next app and the TTS service together:

```bash
pnpm dev:all
```

Your app template should now be running on [localhost:3000](http://localhost:3000).

