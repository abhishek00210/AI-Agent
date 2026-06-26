# Architecture Overview

## Boundary Model

The platform is split into two apps and four shared packages.

- `apps/web` owns the browser application and route-level UI.
- `apps/api` owns HTTP APIs, security middleware, integrations, and persistence.
- `packages/ui` owns shared shadcn-style primitives.
- `packages/shared` owns cross-app validation helpers.
- `packages/types` owns API/domain type contracts.
- `packages/sdk` owns typed client access to the API.

## Backend Modules

NestJS modules are organized by domain:

- Auth
- User
- Organization
- Agent
- Voice
- Twilio
- Billing
- Storage
- Analytics
- Health

Controllers expose placeholder capability endpoints. Services and repositories are the intended expansion points for future business logic.

## Persistence

Prisma models include organizations, users, organization membership, and agents. All models support soft delete with `deletedAt`.

## Integration Strategy

Twilio, OpenAI Realtime, Stripe, and S3-compatible storage are structural only on Day 1. Each has typed config and provider/service boundaries so implementation can be added without reshaping the app.

## Security Baseline

The API includes Helmet, CORS, request IDs, validation pipes, Zod validation support, JWT guard structure, refresh-token structure, password hashing, request logging, and exception filtering.
