# Local Development Guide

## Running With pnpm

Start local PostgreSQL and Redis first. The default `.env.example` expects:

- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ai_agent_platform?schema=public`
- `REDIS_URL=redis://localhost:6379`

```bash
cp .env.example .env
pnpm install
pnpm db:generate
pnpm dev
```

Turbo starts the web and API apps in parallel.

## Health Check

```bash
curl http://localhost:4000/api/v1/health
```

The health endpoint checks the API process, PostgreSQL query path, and Redis ping path.

## Code Quality

```bash
pnpm lint
pnpm typecheck
pnpm build
```

Husky and lint-staged are configured for future git hooks.
