# Contributing to Echostash

Thanks for jumping in. This guide gets you from clone → running → shipping a milestone.

## Prerequisites

- Node ≥ 20
- [pnpm](https://pnpm.io) ≥ 10 (`corepack enable` or install globally)
- Docker (for Postgres + Redis)

## Setup

```bash
git clone <repo> && cd echostash-oss
pnpm install
cp env.example .env
docker compose up -d postgres redis
pnpm db:generate                       # only after schema changes; a migration already exists
pnpm --filter @echostash/server dev    # http://localhost:8080/healthz
```

> **Port conflicts?** If `5432`/`6379` are taken on your machine, change the host ports in
> `docker-compose.yml` and the matching URLs in `.env`.

## Day-to-day

```bash
pnpm build        # turbo build (respects package dependency order)
pnpm typecheck    # tsc --noEmit across the workspace
pnpm lint         # biome check  (pnpm lint:fix to auto-format)
pnpm test         # vitest across packages
```

Run all four before opening a PR — that's exactly what CI runs
(`.github/workflows/ci.yml`).

## How the repo is organized

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design. Short version:

- `packages/shared` — the contract: zod schemas + types + the server↔runner eval protocol.
  **Change this first** when you touch a data shape; server, runner, and web all import it.
- `packages/discovery` — the usage-anchored prompt scanner (M2).
- `packages/scoring` — the isomorphic scorer engine.
- `packages/runner` — the eval executor (M3+).
- `packages/cli` — `echostash` commands.
- `apps/server` — control plane (Fastify + Drizzle). New API features go in
  `src/modules/<feature>/`.
- `apps/web` — React + Vite UI (built out in M3).

## Conventions

- **Imports are extensionless** (`from './client'`, not `'./client.js'`). Required by
  `drizzle-kit` and idiomatic for our `moduleResolution: Bundler`. Don't add `.js`.
- **Types from `@echostash/shared`** — don't redefine a shape that already lives there; add
  it there and import it.
- **Validate at the edges** with the shared zod schemas (request bodies, ingest payloads,
  the runner protocol).
- **Formatting/linting is Biome**, not ESLint/Prettier. Let `pnpm lint:fix` do the work.
- **Commits:** `type(scope): message` — e.g. `feat(discovery): detect openai call sites`,
  `fix(server): idempotent scan upsert`. Scopes: `discovery`, `scoring`, `runner`, `cli`,
  `server`, `web`, `shared`, `ci`, `docs`.
- **Branches:** `feat/…`, `fix/…`, `chore/…`. Never push to `main`.

## Database changes

1. Edit the schema in `apps/server/src/db/schema/`.
2. `pnpm db:generate` → commits a new SQL migration under `src/db/migrations/`.
3. The server applies migrations on boot (`MIGRATE_ON_START=true`) or via `pnpm db:migrate`.

Keep snapshots **append-only** — we observe versions, we don't mutate them.

## Picking up work

1. Open [docs/ROADMAP.md](docs/ROADMAP.md) and find a task (look for `🟢` good-first-issues).
2. Open/claim a GitHub issue so we don't double up.
3. Each task lists the files to create and an acceptance check. Add tests (Vitest) — for the
   scanner, fixture repos under `packages/discovery/test/fixtures/` are the gold standard.
4. Open a PR; make sure `build`/`typecheck`/`lint`/`test` are green.

## Good first issues right now

- `discovery`: add a fixture repo + test pinning expected `DiscoveredPrompt[]` (M2).
- `runner`: write the `cost.ts` pricing table (M3).
- `web`: scaffold the dark theme shell (Tailwind + shadcn) for the registry (M2).
- `server`: the `sha-256(stableStringify(x))` hash helper used by scan ingest (M2).
