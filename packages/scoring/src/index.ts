import type { Scorer, ScorerFamily, ScorerResult } from '@echostash/shared'
import { evaluateJudge } from './judge'
import { scoreOperational } from './operational'
import { scoreString } from './string'
import { scoreStructural } from './structural'
import { scoreToolSelection } from './tool-selection'
import type { EvalContext, JudgeFn, ScoreOutcome } from './types'

export * from './types'
export * from './catalog'
export * from './tool-selection'
export { buildJudgePrompt, parseJudgeVerdict } from './judge'

export interface EvaluateOptions {
  /** Required for llm_judge scorers; supplied by the runner (data plane). */
  judge?: JudgeFn
}

function defaultThreshold(family: ScorerFamily): number {
  if (family === 'llm_judge') return 0.5
  if (family === 'similarity') return 0.8
  return 1 // deterministic families must fully pass
}

/** Run one scorer against one output. Never throws — failures become an `error` result. */
export async function evaluate(
  scorer: Scorer,
  ctx: EvalContext,
  opts: EvaluateOptions = {},
): Promise<ScorerResult> {
  try {
    let outcome: ScoreOutcome
    switch (scorer.family) {
      case 'string':
        outcome = scoreString(scorer.op, scorer.config, ctx.output)
        break
      case 'structural':
        outcome = scoreStructural(scorer.op, scorer.config, ctx.output)
        break
      case 'operational':
        outcome = scoreOperational(scorer.op, scorer.config, ctx)
        break
      case 'tool_selection':
        outcome = scoreToolSelection(scorer.op, scorer.config, ctx)
        break
      case 'llm_judge':
        if (!opts.judge) {
          return { scorerId: scorer.id, status: 'error', score: 0, reason: 'no judge fn provided' }
        }
        outcome = await evaluateJudge(scorer.config, ctx, opts.judge)
        break
      default:
        return {
          scorerId: scorer.id,
          status: 'error',
          score: 0,
          reason: `scorer family not implemented yet: ${scorer.family}`,
        }
    }

    const threshold = scorer.threshold ?? defaultThreshold(scorer.family)
    let pass = outcome.score >= threshold
    if (scorer.negate) pass = !pass
    return {
      scorerId: scorer.id,
      status: pass ? 'pass' : 'fail',
      score: outcome.score,
      reason: pass ? undefined : outcome.reason,
    }
  } catch (err) {
    return { scorerId: scorer.id, status: 'error', score: 0, reason: (err as Error).message }
  }
}

/** Convenience: is this scorer runnable without an LLM (so the UI can run it live)? */
export function isDeterministic(scorer: Pick<Scorer, 'family'>): boolean {
  return (
    scorer.family === 'string' ||
    scorer.family === 'structural' ||
    scorer.family === 'operational' ||
    scorer.family === 'tool_selection'
  )
}
