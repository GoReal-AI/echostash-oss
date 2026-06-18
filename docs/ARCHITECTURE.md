# Architecture

This document explains *how* Echostash works and *why* it's built this way. If you're
picking up a milestone, read this first — most design questions are answered here.

## The product in one paragraph

Echostash watches the prompts that live in your codebase (it never stores them), detects
when one changes — content, model, or params — and lets you eval/regression-test them
without writing test harnesses or booting your app. It is complementary to runtime tracers
like Langfuse: they watch your *traffic*; we watch your *prompts*.

## Two key ideas

### A. Agentless discovery (no annotations, no SDK)

You can't reliably scan arbitrary code for "strings that look like prompts." So we don't.
Instead we **anchor on LLM call sites**, which are structurally unmistakable in an AST:

```
openai.chat.completions.create({ model, messages, … })
anthropic.messages.create({ model, system, messages })
generateText / streamText({ model, messages })          // Vercel AI SDK
genAI.getGenerativeModel({ model }).generateContent(…)   // Google / Vertex
new ChatOpenAI({ model }).invoke(…)                      // LangChain
litellm.completion(model=, messages=)                    // LiteLLM
```

At each call site the analyzer reads off:
- the **model** (string literal, or a variable it can trace),
- the **params** (temperature, top_p, max_tokens, seed, …),
- the **prompt / messages** argument, resolved as far as statically possible:

| Source shape | Resolution |
|---|---|
| inline literal / template | `resolved` — hash it directly |
| `const` / imported variable | follow the binding (intra-file + across imports) |
| `fs.readFile('p.md')` / `import x from './p.txt'` | follow to the file + hash it |
| runtime-assembled (RAG, conditionals) | `partial`/`dynamic` — capture a skeleton with `{{holes}}` |

Each snapshot stores a **`contentHash`** (the prompt text) and a **`configHash`** (model +
params). Either changing produces a new snapshot — *that's* how we flag "the model changed".

**Identity** is the call-site fingerprint (`file:enclosingSymbol` + a structural
disambiguator), so a prompt's versions group together even as its content changes, and it
survives refactors via git rename tracking. We auto-name it from the enclosing symbol; the
user can rename it in the UI.

This is read by two surfaces over the same call-site signal:
- the **scanner** (`echostash scan` / GitHub App) at build/CI time → discovery + git-tied
  change monitoring, even before a prompt ever runs;
- (later) optional connectors for prompts that live outside code — see "Sources" below.

### B. Control plane / data plane split

Eval is LLM-bound: many requests, slow, rate-limited. If the app server ran evals it would
bottleneck and burn a shared quota. So we split:

- **Server = control plane.** Stateful, single instance. Holds the registry, snapshots,
  datasets, scorers, variants, and **eval results**; serves the API + UI. **It never calls
  an LLM** — it orchestrates and stores.
- **Runner = data plane.** Stateless, scalable, ephemeral. Takes a job (variants × cases ×
  scorers), runs the providers with its own concurrency + backoff, and **posts results back
  over the HTTP API**. It carries its own provider layer and keys.

One `runner` codebase, **three entrypoints**:
1. **GitHub Action** — runs inside *your* CI, scoped to the PR's changed prompts, using
   *your* keys from CI secrets. No standing infra; your quota.
2. **Queue worker** — the server enqueues a job (Redis/BullMQ); a worker consumes it. Can
   sit next to the server for small self-host, or scale out as containers.
3. **CLI** — the same executor on a laptop.

**Keys are separated by design:** interactive sandbox runs use the server's central keys;
CI/bulk runs use the project's own keys (the server never sees them).

The keystone concept tying it together: a **variant = `(prompt content × model × params)`**
is the single atom shared by the sandbox, the offline eval matrix, and (future) online A/B.

## Sources — "where do your prompts live?"

Onboarding asks this (multi-select) and routes each answer to an ingestion path. The
`sources` table records provenance; every snapshot tags a `sourceId`. The same prompt seen
via two sources reconciles by identity.

| Where | Path | Milestone |
|---|---|---|
| Inline in code / a resource folder / a dedicated repo | static scan (`echostash scan` / GitHub App) | M2 / M5 |
| Your own DB or a third-party prompt store | (future) pull connector | post-v1 |
| Managed in Echostash itself | (future, opt-in) native storage | post-v1 |

The first three collapse into one engine: *point us at the code.*

## Data model

Drizzle ORM + Postgres. `cuid2` text PKs, `timestamptz`, JSONB typed via `.$type<>()`
against the zod types in `@echostash/shared`. Schema lives in
`apps/server/src/db/schema/` (`awareness.ts`, `eval.ts`, `auth.ts`).

**Awareness**
- `sources` — provenance of an ingestion (scan, github_app, connector, …).
- `prompts` — identities (the stable call-site `fingerprint`).
- `prompt_snapshots` — append-only observed versions; `contentHash` + `configHash`.
- `scan_runs` — one row per scan; drives the change feed.
- `projects`, `tags`, `prompt_tags`.

**Stability (eval)**
- `variants` — the `(prompt × model × params)` atom.
- `datasets`, `dataset_cases` — test inputs (manual or imported).
- `scorers` — deterministic | llm_judge | semantic | code | human.
- `eval_runs` — one run; `trigger` (sandbox|manual|ci), `executor` (worker|ci_action|cli).
- `eval_run_cells` — one executed matrix cell (variant × case × sample).
- `eval_scores` — a scorer's verdict on a cell.

**Auth/config**
- `api_keys` — hashed, prefix-indexed; for SDK/runner/CI ingestion.
- `workspace_settings` — optional encrypted per-instance provider keys / LiteLLM baseURL.

## The server↔runner protocol

Defined in `@echostash/shared` (`schema/eval.ts`):

- **`EvalJobSpec`** `{ runId, variants[], cases[], scorers[], sampleCount, allowedProviders }`
  — everything a runner needs to execute, with no further server round-trips.
- **`EvalResult`** `{ runId, cells[], scores[], summary }` — what the runner POSTs back
  (may be chunked).

LLM work lives **only** in the runner. The server validates and stores.

## Tech choices

| Concern | Choice | Why |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | shared types, one place, cached tasks |
| Lint/format | Biome | one fast binary, zero plugin sprawl |
| Validation | zod in `@echostash/shared` | one contract for server + runner + (future) web |
| DB | Drizzle + Postgres (`postgres` driver) | code-first schema, typed JSONB |
| Module resolution | `Bundler` + extensionless imports | works with tsx/tsup/vite/vitest/drizzle-kit |
| Server | Fastify | fast, plugin model, good TS support |
| LLM layer (runner) | Vercel AI SDK + LiteLLM baseURL | native multi-provider, plus the long tail |

> **Imports are extensionless** (`from './client'`, not `'./client.js'`). This is required
> by `drizzle-kit`'s loader and is idiomatic for `moduleResolution: Bundler`. Keep it
> consistent.
