# AI Agent Platform

Day 1 production foundation for an AI voice agent SaaS platform.

## Stack

- Frontend: Next.js 15, TypeScript, Tailwind CSS, shadcn/ui-style primitives, TanStack Query, Zustand, React Hook Form, Zod
- Backend: NestJS, TypeScript, Prisma, PostgreSQL, Redis
- Infrastructure: Native local services, Nginx-ready reverse proxy config
- Integrations: structural modules for Twilio, OpenAI Realtime, Stripe, and S3-compatible storage

## Quick Start

Start PostgreSQL and Redis locally, then run:

```bash
cp .env.example .env
pnpm install
pnpm db:generate
pnpm dev
```

Open:

- Web: http://localhost:3000
- API health: http://localhost:4000/api/v1/health

## Local Services

The project does not use Docker. Configure `.env` with native/local service URLs:

- PostgreSQL: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ai_agent_platform?schema=public`
- Redis: `REDIS_URL=redis://localhost:6379`

## Monorepo

```text
apps/web        Next.js dashboard shell
apps/api        NestJS API
packages/ui     Shared UI primitives
packages/shared Shared validation helpers
packages/types  Shared TypeScript contracts
packages/sdk    Typed API client structure
prisma          Prisma schema and migrations
docs            Setup and architecture docs
infrastructure  Nginx-ready config
```

## Scripts

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm db:generate
pnpm db:migrate
```

Business features are intentionally not implemented yet. This repository establishes the architecture, security defaults, module boundaries, environment validation, and local development workflow.
