# Eval Engine Spec

How Echostash tests prompts. This is the source of truth for the eval runner (M4) and the CI
gate (M5). It merges what the old Echostash eval engine actually did with eval best practice and
our scoping decisions.

## Concepts

- **Case** — one test input. Fields: `input` (variables for the prompt), optional `messages`
  (a *mocked conversation* seed — user/assistant turns prepended before the model responds, so
  multi-turn behavior is tested one turn at a time), optional `expected` (gold output, used by
  judge/similarity). Lives in a **dataset**.
- **Scorer** — one check applied to an output. Common shape:
  `{ family, op, config, target, weight, threshold, negate }`.
  - `target` — what it inspects: `response` (default) · later: `tools`, `render`.
  - `weight` — relative importance in the aggregate (default 1).
  - `threshold` — for scored (0–1) scorers, the pass cutoff.
  - `negate` — invert pass/fail (so "must NOT leak secrets" = a judge scorer with `negate: true`).
  - Result per scorer: `{ status: pass|fail|error, score: 0..1, reason? }`. Boolean scorers
    report score 1/0.
- **Variant** — `(prompt content × model × params)`. The thing under test.
- **Run** — a **variant × case × N-sample** matrix, scored and aggregated, compared to a baseline.

## Phase 1 scorers

### String / regex (deterministic)
`contains · not_contains · equals · matches (regex, ReDoS-guarded + timeout) · starts_with ·
ends_with · length {min,max} · word_count {min,max}`. Boolean.

### Structural (deterministic)
`json_valid · json_schema {schema} · yaml_valid`. Boolean. (`json_schema` was declared but never
implemented in the old engine — we implement it properly with a JSON-schema validator.)

### LLM-judge (model-graded) — upgraded
- Config: `{ rubric, model?, scale: 'binary'|'unit'(0–1)|'likert'(1–5), threshold?, useExpected? }`.
- The judge model is **configurable** (old engine hard-coded gpt-4o-mini); defaults to a cheap
  strong model. Runs in the runner (data plane), `temperature: 0`.
- Returns a **score (0–1) + reasoning**, not just a boolean. `threshold` decides pass. With
  `negate`, the rubric is a prohibition ("gave confidential info", "was rude").
- Covers the examples: *"short & calm?"*, *"about X?"*, *"leaked confidential info?"* (negate),
  *"asked the user to confirm?"*, *"refused appropriately?"*, RAG faithfulness vs `expected`.
- Output contract the judge must return: `{"score": 0..1, "pass": bool, "reason": "..."}`
  (markdown fences stripped, parsed leniently).

### Operational (deterministic, free — carried from old)
`latency {max} · token_count {min,max} · cost {max}`. Boolean. Use the eval call's own metrics.

## Scoring & aggregation

- **Samples:** each (variant, case) runs `N` times (default 1; raise for nondeterministic prompts).
  Report **pass-rate and mean ± variance** per cell — never a single coin-flip.
- **Cell → case → variant:**
  - cell score = weighted mean of its scorer scores (a scorer "fails" if `score < threshold`).
  - case = passes if all required scorers pass (or weighted-score ≥ case threshold).
  - variant score = weighted pass-rate (or mean score) across cases, 0–100.
- **Baseline + regression:** every run records a `baselineRunId`; the UI/CI compute the **delta**.
  The **CI gate (M5)** blocks a PR when a changed prompt's score drops past a configured threshold.
- A run row stores `summaryTotal/Passed/Failed/Errored`, `score`, `durationMs`, `configHash`.

## Runner & caching

- All scorer execution + LLM/judge/embedding calls happen in the **runner** (data plane), never the
  server. CI runs use the **project's own keys**.
- **Cache** LLM responses and judge/embedding results by `sha256(renderedInput + modelConfig)` and
  `sha256(scorerConfig + output)` so re-runs are cheap (carried from old engine; Redis or local).
- **Tool loop** (when tools are present): bounded iterations; tool results come from per-case
  **mocks** so eval is deterministic and offline. (Assertions on tool calls are a backlog family.)

## Targets

Phase 1 evaluates the **LLM response**. (The old engine merged "render" and "llm" assertions and
ran everything on the response anyway.) `tools` and `render` targets come with the tool-usage and
template-diffing work later.

## Deferred families (backlog — see GitHub issues, milestone M4)

- **Similarity** — embed `expected` vs output, cosine, user threshold; configurable embedding
  model; optional cheap string-distance (levenshtein/rouge). *(old engine had `similar_to`.)*
- **Tool-usage** — `tool_called · tool_not_called · tool_call_count · tool_args · tool_call_order`
  + per-case tool mocks. *(old engine had all of these.)*
- **Sentiment** — classify positive/negative/neutral (or fold into llm-judge).
- **Self-consistency** — run N×, require min pairwise similarity ≥ threshold. *(old `deterministic`.)*
- **Simulated-user multi-turn** — an LLM user-simulator driving a conversation toward a goal, with
  trajectory assertions. (Explicitly *not* phase 1 — mocked-conversation cases cover the need.)

## Data-shape sketch (lands in @echostash/shared at M4)

```ts
ScorerFamily = 'string' | 'structural' | 'llm_judge' | 'operational'
              // later: 'similarity' | 'tool' | 'sentiment' | 'self_consistency'
Scorer = { id, name, family, op, config, target: 'response', weight, threshold?, negate }
DatasetCase = { id, name, input, messages?: Message[], expected?, position }
ScorerResult = { scorerId, status: 'pass'|'fail'|'error', score: number, reason?: string }
```
