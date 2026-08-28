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

1. **Awareness** — a language-agnostic scanner finds the LLM call sites in your code, reads off
   the prompt + model + params, hashes them, and flags any change on every push. *Change a
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
quota.

**📐 Want the full product picture — every screen + the v1 scope?** See
[docs/PRODUCT.md](docs/PRODUCT.md). For architecture/design, [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Audit an MCP server's tool surface

An MCP server's tool definitions **are prompts**: the `name`, `description`, and `inputSchema`
are the only things a model sees when deciding which tool to call. Reword a description and
tool-selection accuracy moves — but the change ships through a PR looking like a docstring edit.

```bash
echostash mcp audit https://your-server.example.com/mcp
echostash mcp audit --command "npx -y @acme/mcp-server"   # spawned with a minimal env; --env k=v to add
```

No API key, no server, no database, no model calls — it reads `tools/list` (and nothing else;
auditing is side-effect free) and analyzes it deterministically:

```
  acme-support · 2 tools
  protocol 2026-07-28

  Tool Surface Score  97.5/100     context cost ~126 tokens/request

  ! description-thin (1)
      "refund_order" has a 16-character description
  - no-negative-guidance (1)
      "refund_order" never says when *not* to use it
```

It checks confusable tool pairs, unbounded or undescribed schemas, missing negative guidance
("not for X — use Y instead"), name hygiene, behavioural annotations, and what the surface
costs you in context tokens on **every** request.

Each run writes `.echostash/mcp-baseline.<server>.json`. **Commit it**, then gate your PRs:

```bash
echostash mcp audit <target> --check     # exit 1 when the score regresses
```

Code gets reviewed; prompts don't. This closes that gap. Selection-accuracy eval (synthetic
**and** hand-written queries → a confusion matrix showing which tool steals which one's traffic)
is [tracked in M7](https://github.com/GoReal-AI/echostash-oss/issues/93).

## Status

This is an early, in-progress build. Milestones:

| Milestone | What | Status |
|-----------|------|--------|
| **M0** | Monorepo skeleton (pnpm + Turborepo + Biome + TS) | ✅ done |
| **M1** | Shared schemas + DB schema + server boot + migrations | ✅ done |
| **M2** | Usage-anchored discovery (call-site detection) + scan ingest + registry UI | 🔜 open |
| **M3** | Runner + provider layer + sandbox | 🔜 open |
| **M4** | Datasets + eval matrix + scorers | 🔜 open |
| **M5** | CI gate + GitHub App | 🔜 open |
| **M6** | Docker images + seed + demo | 🔜 open |

### Contributing — start here

**M2–M6 are wide open** and sliced into issues you can pick up independently:

- 🟢 [**Good first issues**](https://github.com/GoReal-AI/echostash-oss/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) — the easiest way in
- 📋 [**All open issues**](https://github.com/GoReal-AI/echostash-oss/issues) · grouped by [**milestone**](https://github.com/GoReal-AI/echostash-oss/milestones)
- 📖 [docs/ROADMAP.md](docs/ROADMAP.md) — each task with files-to-create + acceptance checks
- 🛠️ [CONTRIBUTING.md](CONTRIBUTING.md) — setup, conventions, how to claim work

Workflow: branch off `main`, open a PR (the template guides you), get CI green + one review.
`main` is protected — no direct pushes.

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

### Seed demo data (optional)

So a fresh clone isn't empty, `pnpm db:seed` loads a sample repo scan (prompts with a
change timeline), a dataset, and one eval run.

> ⚠️ **`db:seed` resets the database to demo data.** It **deletes every prompt, snapshot,
> dataset, and eval run** in the target database — not just demo rows — and replaces them with
> the fixture. Run it only against a throwaway/dev database, never one holding real scans. It
> refuses to run when `NODE_ENV=production`.

Re-running is safe in the sense that it doesn't duplicate rows — it wipes and re-inserts the
same fixture each time. Run it once the schema is applied (after the server has started once,
or after `pnpm db:migrate`):

```bash
# the scripts read config from the environment, so load .env into the shell first
set -a && source .env && set +a

pnpm db:migrate                # apply the schema if the server hasn't already
pnpm db:seed                   # populate prompts + datasets + an eval run
```

Run the whole check suite (what CI runs):

```bash
pnpm build && pnpm typecheck && pnpm lint && pnpm test
```

## Repo layout

```
packages/
  shared/    zod schemas + types + the server↔runner eval protocol
  discovery/ usage-anchored prompt scanner — language-agnostic, ripgrep-based (M2)
  scoring/   isomorphic scorer engine (string / structural / llm-judge)
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
