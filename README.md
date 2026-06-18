<div align="center">

# Echostash

**Agentless prompt change intelligence + eval.**

Echostash watches the prompts in your codebase, tells you the moment one changes
— content, model, *or* parameters — and lets you eval & regression-test them with
zero setup. No annotations, no SDK, no test harness.

</div>

---

## Why

Every "prompt tool" on the market is a **CMS you migrate into**: your prompts move
into their database and you maintain them there. And every observability tool watches
your **runtime traffic** (cost, latency, tokens).

Echostash is neither.

- It is **not a prompt CMS** — your prompts stay exactly where they are (a string, a
  class, a resource file, a repo). We meet them there.
- It is **not a runtime tracer** — cost/latency/traffic observability is
  [Langfuse](https://langfuse.com)'s territory, and we stay out of it. Echostash is
  *complementary*: Langfuse watches your traffic, Echostash watches your **prompts**.

> Think **Sentry for prompts**, not **Notion for prompts**.

### The pain it kills

Today, testing a prompt change means: rebuild your app → navigate to the exact code
path that fires the prompt → feed it inputs → squint at the output. Echostash collapses
that to:

```
we auto-discover your prompts  →  you open one in a sandbox  →  tweak content/model/params
   →  run it against cases  →  see the scored matrix  →  gate regressions in CI
```

## Two pillars

1. **Awareness** — a static analyzer finds the LLM call sites in your code, reads off the
   prompt + model + params, hashes them, and flags any change on every push. *Change a
   prompt or swap a model — we see it.* Zero touch.
2. **Stability / Eval** (the hero) — open any discovered prompt in a sandbox, change the
   content/model/params, run it against datasets, score it, compare variants, and gate
   regressions in CI.

## Architecture at a glance

Echostash is a **control plane / data plane** split so heavy eval work never bottlenecks
the app:

```
                  ┌─────────────────────────────────────────────┐
                  │  Echostash Server  (control plane)           │
                  │  Fastify · Postgres · Redis · Web UI         │
                  │  registry · snapshots · datasets · results   │
                  │  — never calls an LLM; it orchestrates+stores │
                  └─────────────────────────────────────────────┘
                       ▲ post results (project API key)  ▲
        ┌──────────────┴───────────────┐   ┌─────────────┴──────────────┐
        │  Eval Runner (data plane)     │   │  Eval Runner (data plane)  │
        │  GitHub Action — ephemeral,   │   │  Queue worker — sandbox /  │
        │  runs in YOUR CI, YOUR keys   │   │  manual runs               │
        └───────────────────────────────┘   └────────────────────────────┘
              one `runner` codebase · 3 entrypoints (action | worker | cli)
```

The **runner** is stateless and LLM-bound; it talks to the server only over HTTP. CI runs
use *the project's own keys* from CI secrets, so one noisy project can't exhaust a shared
quota. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design.

## Status

This is an early, in-progress build. Milestones:

| Milestone | What | Status |
|-----------|------|--------|
| **M0** | Monorepo skeleton (pnpm + Turborepo + Biome + TS) | ✅ done |
| **M1** | Shared schemas + DB schema + server boot + migrations | ✅ done |
| **M2** | Agentless analyzer (call-site detection) + scan ingest + registry UI | 🔜 open |
| **M3** | Runner + provider layer + sandbox | 🔜 open |
| **M4** | Datasets + eval matrix + scorers | 🔜 open |
| **M5** | CI gate + GitHub App | 🔜 open |
| **M6** | Docker images + seed + demo | 🔜 open |

Want to contribute? **M2–M6 are wide open** — see [docs/ROADMAP.md](docs/ROADMAP.md) and
[CONTRIBUTING.md](CONTRIBUTING.md).

## Quickstart (current state)

Requires Node ≥ 20, [pnpm](https://pnpm.io) ≥ 10, and Docker.

```bash
pnpm install
cp env.example .env            # adjust ports if 5432/6379 are taken locally

# bring up Postgres + Redis
docker compose up -d postgres redis

# generate + apply the DB schema, then run the control-plane server
pnpm db:generate               # only needed after changing the schema
pnpm --filter @echostash/server dev

# in another shell
curl localhost:8080/healthz    # {"status":"ok"}
curl localhost:8080/readyz     # {"status":"ready","db":"ok"}
```

Run the whole check suite (what CI runs):

```bash
pnpm build && pnpm typecheck && pnpm lint && pnpm test
```

## Repo layout

```
packages/
  shared/    zod schemas + types + the server↔runner eval protocol
  analyzer/  agentless static analyzer (M2)
  runner/    stateless eval executor: worker | action | cli (M3+)
  cli/       echostash scan | eval | ci | init
apps/
  server/    control plane — Fastify + Drizzle + Postgres + Redis
  web/        React + Vite dark UI (built out in M3)
actions/
  eval/      GitHub Action that runs the runner in CI (M5)
```

## License

MIT — see [LICENSE](LICENSE).
