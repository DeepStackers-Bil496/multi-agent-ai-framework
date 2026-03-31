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

## Test Runs

### Vitest — unit + integration (no browser, no server needed)

pnpm test:unit # run once
pnpm test:unit:watch # watch mode
pnpm test:unit:coverage # with coverage
pnpm test:integration # integration tests
pnpm test:integration:watch # integration watch mode

### Playwright — route + e2e (requires pnpm dev or pnpm test which starts it)

pnpm test # everything
pnpm exec playwright test --project=routes # API route tests only
pnpm exec playwright test --project=e2e # browser tests only
