# Echostash — working agreement (read this first)

Instructions for anyone (and any Claude Code session) working in this repo. Keep changes
consistent with what's here. Auto-loaded by Claude Code.

## What this is

**Echostash is agentless prompt change-intelligence + eval.** It watches the prompts that live
in your codebase, tracks every version (content + model + params) as they change in git, and lets
you eval / regression-test them with zero setup.

- **Not a prompt CMS** — prompts stay in the user's code; we are never the source of truth.
- **Not a runtime tracer** — cost/latency/traffic observability is **Langfuse's** territory. We're
  complementary. We own *the prompts*.

> Sentry for prompts, not Notion for prompts.

Read these before non-trivial work: [docs/PRODUCT.md](docs/PRODUCT.md) (screens + v1 scope),
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (how/why), [docs/ROADMAP.md](docs/ROADMAP.md)
(per-milestone tasks), [docs/EVAL.md](docs/EVAL.md) (the eval engine), and
[CONTRIBUTING.md](CONTRIBUTING.md).

## Stack

- **Monorepo:** pnpm workspaces + Turborepo. **Lint/format:** Biome (not ESLint/Prettier).
  **Tests:** Vitest. **Validation:** zod.
- **TypeScript:** strict, `moduleResolution: "bundler"`, **extensionless relative imports**.
- **Server (control plane):** Fastify + Drizzle ORM + Postgres + Redis.
- **Web:** React + Vite + Tailwind v4 + TanStack Query + React Router (dark).
- **Runner (data plane):** the eval executor; provider layer = Vercel AI SDK + LiteLLM.
- **Scoring:** `@echostash/scoring` — the isomorphic scorer engine.

```
packages/  shared (zod contract + server↔runner protocol) · discovery (prompt scanner) ·
           scoring (scorer engine) · runner (eval executor) · cli (echostash scan|eval|ci)
apps/      server (control plane API) · web (UI)
actions/   eval (GitHub Action — CI eval gate)
```

## Architecture in three lines

1. **Usage-anchored discovery** (`@echostash/discovery`) — ripgrep finds **LLM call sites** (a
   catalog of SDK shapes + a framework-agnostic structural anchor on prompt-bearing keys), then
   resolves each prompt argument back to its definition. A string is a prompt because it *flows into
   an LLM call*, not because it looks like one. Identity = the prompt's definition (`file:symbol`).
2. **Control plane / data plane** — the **server never calls an LLM**; it orchestrates and stores.
   The **runner** does all LLM/judge/embedding work and posts results back over HTTP.
3. **`variant = (prompt content × model × params)`** is the shared atom across sandbox, eval, A/B.

## Conventions

- **Change `@echostash/shared` first** when a data shape changes; everything imports the contract.
- **Validate at the edges** with the shared zod schemas (request bodies, ingest, runner protocol).
- **Extensionless imports** (`from './client'`, never `'./client.js'`) — required by drizzle-kit.
- **Scoring lives in `@echostash/scoring`** — don't reimplement assertion logic elsewhere.
- **Commits:** `type(scope): message` (scopes: discovery, runner, scoring, cli, server, web, shared,
  ci, docs). **Branches:** `feat/…`, `fix/…`, `chore/…`. PRs use the template; **squash-merge**.
- **DB changes:** edit `apps/server/src/db/schema/*`, then `pnpm db:generate` (commit the migration).
  Snapshots are **append-only** — we observe versions, we don't mutate them.

## What we DO NOT do

- ❌ **Runtime observability** (cost/latency/traffic tracing) — that's Langfuse. At most we *import*
  from a tracer; we don't build one.
- ❌ **Make the tool the source of truth for prompts.** Code is canonical. Managed storage is an
  explicit opt-in, post-v1.
- ❌ **Call LLMs from the server.** All model/judge/embedding calls happen in the **runner**.
- ❌ **`.js` import extensions.** Extensionless only.
- ❌ **Push to `main` or self-merge.** `main` is protected: PR + green CI + review. Never merge a PR
  without explaining + showing + testing it first and getting the owner's OK.
- ❌ **Hand-pin transitive deps for dev-only low/medium advisories.** Security policy: fix *runtime*
  advisories immediately, *dev* ones when convenient, leave dev-only transitives to self-heal.
- ❌ **Secrets in the client.** Provider keys live server/runner-side; CI runs use the project's own
  keys. Never put keys in the browser or the prompt registry.
- ❌ **Heavy deps by reflex.** Prefer the existing kit; justify new dependencies.

## How to take on an issue

> **Golden rule — no undocumented work, no silent collisions.** Many people (and many Claude Code
> agents) work this repo in parallel. *Everything* you do maps to an issue you've **claimed**, and
> you **report** as you go. This applies to AI agents too: if you're running Claude Code here, follow
> this protocol exactly — do not start editing code that isn't tied to an issue assigned to you.

1. **There must be an issue.** Pick one from [good first issues](https://github.com/GoReal-AI/echostash-oss/labels/good%20first%20issue)
   or by [milestone](https://github.com/GoReal-AI/echostash-oss/milestones). No issue for what you
   want to do? **Open one first** (state the problem + intended change) — never work undocumented.
   If it's labeled `design`, resolve the design question in the issue before coding.
2. **Claim it before you touch code** — comment `/assign` (or `.take`) on the issue. A bot assigns
   you (no repo access needed) and labels it `in progress`; it refuses if someone already holds it,
   so check for an assignee first and pick another if taken. Stopping early? Comment `/unassign`.
3. **Read** the matching section of [docs/ROADMAP.md](docs/ROADMAP.md) (files-to-create + the
   acceptance check) plus the relevant doc.
4. **Branch** off `main`: `feat/<short>` — one issue per branch/PR.
5. **Build it** — shared contract first if shapes change; add **Vitest** tests (discovery → fixture
   repos under `packages/discovery/test/fixtures/`). Comment on the issue if scope/approach shifts,
   so the assignment stays meaningful.
6. **Verify** (this is exactly what CI runs):
   ```bash
   pnpm build && pnpm typecheck && pnpm lint && pnpm test
   ```
7. **PR + report** — open a PR (use the template) that references the issue with a closing keyword
   **per number** (`Closes #11, closes #12` — GitHub only links the first otherwise). The PR link
   posts back to the issue automatically; add a one-line status if anything's partial. Get CI green
   + one review, then squash-merge — which closes the issue. **If you abandon the work, say so on the
   issue and `/unassign`** so it returns to the pool.

## Local setup

```bash
pnpm install
cp env.example .env                       # adjust ports if 5432/6379 are taken
docker compose up -d postgres redis
pnpm db:generate                          # only after schema changes
pnpm --filter @echostash/server dev       # http://localhost:8080/healthz
pnpm --filter @echostash/web dev          # http://localhost:5173
```
