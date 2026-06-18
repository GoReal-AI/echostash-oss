import type { EvalJobSpec, EvalResult } from '@echostash/shared'

export interface RunnerOptions {
  /** Base URL of the Echostash control-plane server. */
  serverUrl: string
  /** Project API key used to fetch the job spec and post results. */
  apiKey: string
  /** Max concurrent LLM requests. */
  concurrency?: number
}

/**
 * Execute an eval job: run every (variant x case x sample) cell against its
 * provider, score each cell, and return the result payload.
 *
 * MILESTONE M3/M4 — not yet implemented. The contract is fixed.
 * Implementation plan:
 *   1. `lib/llm/generate({provider,model,messages,params})` over the Vercel AI
 *      SDK (`@ai-sdk/openai|anthropic|google|google-vertex`); `litellm` ->
 *      `@ai-sdk/openai` with a custom baseURL.
 *   2. Run the matrix with a concurrency limit + per-provider backoff.
 *   3. Apply scorers (deterministic in-process; llm_judge calls a model here in
 *      the data plane — never the server).
 *   4. Compute `costUsd` from a pricing table (lib/llm/cost.ts).
 */
export async function runEval(_spec: EvalJobSpec, _options: RunnerOptions): Promise<EvalResult> {
  throw new Error('Runner not implemented yet — see packages/runner (milestone M3/M4).')
}

export const RUNNER_MILESTONE = 'M3' as const
