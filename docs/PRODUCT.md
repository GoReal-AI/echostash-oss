# Echostash — Product Spec

This is the shared picture of **what we're building**: the product, every screen, and the v1
scope. For the build sequence see [ROADMAP.md](ROADMAP.md); for the why/how see
[ARCHITECTURE.md](ARCHITECTURE.md).

## What it is (and isn't)

Echostash is a self-hostable tool that **watches the prompts in your codebase** and lets you
**eval them with zero setup**. You point it at your repo; it finds every LLM prompt in your code,
tracks every version (content + model + params) as they change in git, and lets you open any
prompt, try variations against test cases, score them, and **block regressions in CI**.

- **Not a prompt CMS** — your prompts stay in your code; we never become the source of truth.
- **Not a runtime tracer** — cost/latency/traffic observability is Langfuse's job. We're
  complementary: they watch your *traffic*, we watch your *prompts*.

> Sentry for prompts, not Notion for prompts.

## The core loop

```
discover (scan your code)  →  open a prompt in the sandbox  →  try variants
   (model / params / wording)  →  run against a dataset  →  score + compare
   →  gate regressions in CI  →  (you edit the prompt in YOUR code)  →  re-discover
```

## Information architecture

A dark, left-nav app with six destinations:

```
Echostash
  ▸ Prompts     the map of every prompt discovered across your repos
  ▸ Sandbox     open one, try model/param/wording variations, run it
  ▸ Datasets    test cases (inputs + optional expected output)
  ▸ Evals       run a variant × case matrix, compare, see regressions
  ▸ Sources     connected repos, scan status, recent-change feed
  ▸ Settings    provider keys (sandbox), API keys (SDK/CI)
```

## Screens

### 1 · Prompts (registry)
Your prompt surface area across all repos. Filter by repo, model, eval status; search.

```
Prompts          search    repo:[all]  model:[all]  status:[all]
──────────────────────────────────────────────────────────────────────
 NAME            FILE                MODEL              RES   VERS EVAL    CHANGED
 summarize       api/chat.ts:14      openai/gpt-4o      ●res   3   ✓ 92%   2h ago
 classifyIntent  api/intent.ts:8     anthropic/sonnet   ◐par   1   ✗ 71%   1d ago
 ragAnswer       rag/answer.ts:31    openai/gpt-4o-mini ○dyn   5   – none  3d ago
```
`RES` = how completely we resolved the prompt from source (resolved / partial / dynamic).

### 2 · Prompt detail — the change timeline
Every observed version, what changed, tied to git (sha / branch / author / date), with a diff
between any two versions, the latest resolved messages, and linked datasets + eval history.

```
summarize                                   [Open in Sandbox] [Run eval]
api/chat.ts:14 · openai/gpt-4o · 3 versions
──────────────────────────────────────────────────────────────────────
 ● v3  gpt-4o         model changed    main a3f9c  dana  2h   eval ✓92% (+4%)
 ○ v2  gpt-4o-mini    content changed  main 7b21e  yoad  1d
 ○ v1  gpt-4o-mini    first seen       main 41ee0  yoad  6d      [Diff v3↔v2]
```

### 3 · Sandbox (the hero)
Open a discovered prompt (or paste an ad-hoc one). Edit the messages, pick a model, tune params —
that's a **variant**. Run it against a dataset or ad-hoc inputs; see output + tokens + cost.
Add a second variant to compare side by side. "Copy to code" gives you the diff to paste back.

```
Sandbox — summarize                          [+ Compare variant] [Copy to code]
┌ Variant A ───────────────┐  ┌ Inputs ─────────────────────────────┐
│ model [openai/gpt-4o]    │  │ dataset [support-cases] / ad-hoc    │
│ temp 0.2  max 500        │  │ {{text}} = "long article…"          │
│ [system] You are terse…  │  └─────────────────────────────────────┘
│ [user]  Summarize:{{text}}│  ┌ Output ─────────────────────────────┐
└──────────────────────────┘  │ "The article argues…"               │
                              │ 312 tok · $0.004 · 1.2s  ✓ ✓ ✗      │
```

### 4 · Evals — the variant × case matrix
Configure: prompt, a set of variants (prompt × model × params), a dataset, scorers, sample count.
Run. Results are a matrix — variants across the top, cases down the side, a score per cell, an
aggregate per variant, and deltas vs a baseline. Click a cell for the output + per-scorer detail.

```
Eval · summarize · support-cases (20 cases) · 3 scorers          [Re-run]
──────────────────────────────────────────────────────────────────────
              A: gpt-4o t0.2     B: gpt-4o-mini      C: claude-sonnet
 SCORE        92%  ◀ baseline    88%  ▼ −4%          90%  ▼ −2%
──────────────────────────────────────────────────────────────────────
 refund       ✓✓✓                ✓✓✗                ✓✓✓
 greeting     ✓✓✓                ✓✓✓                ✓✗✓
 edge-1       ✓✗✓                ✗✗✓                ✓✓✓
```

### 5 · CI gate
The payoff. When a prompt changes in a PR, its eval runs (in CI, with the project's own keys) and
the check fails if the score regresses past a threshold.

```
PR #128 "tweak summarizer"                     echostash/eval  ✗ failing
 Changed: summarize (content + model)
 support-cases: 92% → 84%  ▼−8%  (threshold 90%)  ✗ BLOCK
 regressed: refund, edge-1
```

### 6 · Supporting screens
- **Datasets** — rows of test inputs (variables + optional expected output); built by hand, CSV/JSON
  import, or (later) pulled from a tracer.
- **Scorers** — how outputs are judged: deterministic (contains / regex / json-schema / …),
  LLM-as-judge (a rubric), semantic similarity. Reusable across datasets and evals.
- **Sources** — connect a repo, see scan status and a recent-changes feed.
- **Settings** — provider keys (central, for the sandbox) and API keys (for SDK/CI ingest).

## v1 scope — "the full loop"

v1 ships the complete loop, because discovery + a viewer without eval/CI is just a prompt browser:

- **Awareness** — scan (more providers + cross-file/file-loaded prompts), registry, change timeline,
  version diffs.
- **Sandbox** — open a prompt, edit model/params/messages, run against ad-hoc inputs **and**
  datasets, streamed output + cost; multi-variant compare.
- **Eval** — datasets + cases, scorers (deterministic + LLM-judge), the variant × case matrix,
  compare + regression-vs-baseline.
- **CI gate** — `echostash ci` + the GitHub Action: changed prompts → eval → block on regression.
- **Ship** — Docker compose, seed data, self-host docs.

### Deferred (post-v1)
GitHub App (webhook auto-scan; the CI Action covers v1) · more provider analyzers + Python ·
online A/B in production · managed-prompt storage (opt-in) · import datasets from Langfuse/Helicone ·
autoscaling worker pool.

## How this maps to the build
Awareness = M2 · Sandbox = M3 · Eval = M4 · CI gate = M5 · Ship = M6. See
[ROADMAP.md](ROADMAP.md) for per-milestone tasks and [the issues](https://github.com/GoReal-AI/echostash-oss/issues).
