/** What the model produced, plus call metrics, for scorers to inspect. */
export interface EvalContext {
  output: string
  expected?: unknown
  toolChoice?: { name: string | null }
  metrics?: {
    latencyMs?: number
    totalTokens?: number
    costUsd?: number
  }
}

/** A scorer family function returns a 0..1 score (1 = full pass) + an optional reason. */
export interface ScoreOutcome {
  score: number
  reason?: string
}

/** Injected by the runner (data plane): send a prompt to the judge model, get raw text back. */
export type JudgeFn = (prompt: string) => Promise<string>

export function bool(pass: boolean, reason?: string): ScoreOutcome {
  return { score: pass ? 1 : 0, reason: pass ? undefined : reason }
}
