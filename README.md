# MULTI-AGENT AI FRAMEWORK

Multi-agent AI framework is a framework for building multi-agent AI applications.

## Running locally

You will need to use [pnpm](https://pnpm.io/installation) to install dependencies and run the application.

1. **Install dependencies:**

```bash
pnpm install
```

2. **Copy environment variables:**

```bash
cp .env.example .env.local
```

3. **Set up the database:**

Ensure you have a PostgreSQL database (e.g., [Neon](https://neon.tech/)). Then, push the schema:

```bash
pnpm db:push
```

4. **Run the application:**

```bash
pnpm dev
```

Your application should now be running on [http://localhost:3000](http://localhost:3000).
