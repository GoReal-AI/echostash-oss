# Roadmap

The goal: a self-hostable tool that **discovers the prompts in your codebase, monitors when
they change, and lets you eval them with zero setup** — plus a CI gate that catches
regressions. We build it milestone by milestone; each one leaves a runnable, verifiable app.

**Done:** M0 (skeleton) · M1 (shared schemas + DB + server boot). Everything below is open.

Pick a milestone, open an issue to claim it, and read [CONTRIBUTING.md](../CONTRIBUTING.md).
Each milestone lists concrete tasks; `🟢` = good first issue, `🟡` = medium, `🔴` = meaty.

---

## M2 — Agentless analyzer + scan ingest + registry UI

> The "magic": run a scan on a repo and watch its prompts (and their models/params) appear.

**Package:** `packages/analyzer` (contract stubbed in `src/index.ts`), plus server + cli + web.

Tasks:
- 🔴 **Call-site detection.** Parse TS/JS with the TypeScript compiler API; match the known
  LLM call shapes (see [ARCHITECTURE.md](ARCHITECTURE.md#a-agentless-discovery-no-annotations-no-sdk)).
  Return one `DiscoveredPrompt` per call site. Start with OpenAI + Vercel AI SDK; add
  Anthropic/Google/LangChain/LiteLLM incrementally.
- 🟡 **Content resolution.** Inline literal → `resolved`. Follow `const`/import bindings.
  Follow `fs.readFile` / file imports. Runtime-assembled → skeleton with `{{holes}}`,
  `resolution: 'partial' | 'dynamic'`.
- 🟡 **Fingerprinting.** `file:enclosingSymbol` + a structural disambiguator; stable across
  content edits.
- 🟢 **Fixture tests.** Drop sample repos under `packages/analyzer/test/fixtures/` and assert
  the produced `DiscoveredPrompt[]` (Vitest). This is the best first issue — it pins behavior.
- 🟡 **`echostash scan` (cli).** Walk the repo, gather git context (`git rev-parse`, ref,
  author), call the analyzer, POST a `ScanReport` to `/api/ingest/scan`.
- 🟡 **`POST /api/ingest/scan` (server).** New module `apps/server/src/modules/ingest/`.
  Upsert `prompts` by `fingerprint`; insert a `prompt_snapshots` row when
  `(contentHash, configHash)` is new; write a `scan_runs` row; return `ScanReportResult`.
  Hash helper: stable JSON stringify → sha-256.
- 🟡 **Registry UI.** `apps/web` `/prompts` (list: name, model, last change) and
  `/prompts/:id` (snapshot/change timeline + diff). This is where the web app gets its real
  shell — Tailwind + shadcn + TanStack Query/Router land here.

**Verify:** mark nothing — just `echostash scan ../some-repo` → prompts show in `/prompts`
with model + git info; change a model in the repo, re-scan → a new snapshot is flagged.

---

## M3 — Runner + provider layer + sandbox

> Open a discovered (or pasted) prompt, change model/params, run it, watch the output.

**Package:** `packages/runner` (contract stubbed in `src/index.ts`), plus server + web.

Tasks:
- 🔴 **Provider layer.** `runner/src/lib/llm/generate.ts`:
  `generate({provider, model, messages, params, stream})` over the Vercel AI SDK
  (`@ai-sdk/openai|anthropic|google|google-vertex`); `litellm` → `@ai-sdk/openai` with a
  custom `baseURL`. `registry.ts` maps provider → model factory.
- 🟢 **Cost table.** `runner/src/lib/llm/cost.ts` — per-1M token rates per model → `costUsd`.
  Easy, self-contained, high-value first issue.
- 🟡 **Worker entrypoint.** Consume jobs from Redis (BullMQ). For M3 a single colocated
  worker is fine.
- 🟡 **`POST /api/sandbox/run` + `GET /api/providers` (server).** Enqueue an interactive
  run; stream output back via SSE. `/api/providers` advertises providers that have a key.
- 🟡 **Sandbox UI.** `/prompts/:id/sandbox` (and an ad-hoc mode): edit messages/model/params,
  run, stream output + cost. The hero screen.

**Verify:** with a provider key in `.env`, open a scanned prompt, change the model, hit run,
see streamed output + token/cost.

---

## M4 — Datasets + eval matrix + scorers

> Run variants over a dataset, score every cell, compare side-by-side with deltas.

Tasks:
- 🟡 **CRUD modules (server):** `datasets`, `dataset_cases`, `variants`, `scorers`.
- 🔴 **Eval execution (runner):** consume an `EvalJobSpec`, run the
  `variants × cases × samples` matrix with concurrency + backoff, apply scorers, POST
  `EvalResult` to `/api/eval-runs/:id/results`.
- 🟡 **Scorers.** Deterministic ops (contains/regex/json_schema/…) in-process; `llm_judge`
  calls a model *in the runner*. See `AssertionOp` in `@echostash/shared`.
- 🟡 **`POST /api/eval-runs` + spec/results endpoints (server).** Create + enqueue; serve
  `GET /:id/spec`; ingest `POST /:id/results`; aggregate the summary + score.
- 🟡 **Results UI.** `/evals/:runId` — variant × case matrix, per-cell output/scores,
  aggregate deltas, regression-vs-baseline.
- 🟢 **Dataset import.** CSV/JSON upload → `dataset_cases`.

**Verify:** build a dataset, run two variants, see a scored matrix + deltas.

---

## M5 — CI gate + GitHub App

> Change a prompt in a PR → an eval runs in CI with the project's keys → the check fails on a
> regression.

Tasks:
- 🟡 **`echostash ci` (cli).** Scan the diff for changed prompts; for each, fetch its
  dataset+scorers+baseline from the server; run the eval via the runner with the project's
  keys; POST results; set the PR check (pass/fail vs baseline).
- 🟡 **`actions/eval` GitHub Action.** `action.yml` that runs `echostash ci` in CI.
- 🟡 **`POST /api/ci/check` (server).** Given a gitSha + changed fingerprints, run/aggregate,
  return pass/fail + score deltas.
- 🔴 **GitHub App.** `POST /api/github/webhook` — on push, kick a scan; on PR, trigger the CI
  eval. (Can land after the Action.)
- 🟢 **API keys UI + auth plugin.** `apps/server/src/plugins/auth.ts` (apiKey + session),
  `/api/api-keys` CRUD, settings page.

**Verify:** open the example PR → the action runs the eval in GitHub Actions and fails on a
score drop.

---

## M6 — Docker + docs + seed (demoable v1)

Tasks:
- 🟡 Multi-stage Dockerfiles for `server`, `web`, `runner` (use `turbo prune`).
- 🟡 Wire `server`/`web`/`runner` into `docker-compose.yml`; add `docker-compose.prod.yml`;
  add an optional `litellm` profile.
- 🟢 Seed script: a sample repo scan + datasets + an eval run, so a fresh clone has data.
- 🟢 README quickstart polish + a short demo GIF.

**Verify:** clean-machine `docker compose up` → seeded prompts + change timeline, run the
sandbox, view the eval matrix.

---

## Post-v1 ideas

- Python analyzer (second language for the scanner).
- Pull connectors for prompts in your DB / a third-party store.
- Import datasets from Langfuse/Helicone (golden cases from real traffic — respecting the
  boundary: we pull from their territory, we don't capture traffic).
- Online A/B (variants → traffic split, compare on real outcomes).
- Managed-prompt mode (opt-in, tool-canonical storage).
- A standing, autoscaling worker pool.
