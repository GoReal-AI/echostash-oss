import type { AssertionOp } from '@echostash/shared'
import { type EvalContext, type ScoreOutcome, bool } from './types'

const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined)

export function scoreOperational(
  op: AssertionOp,
  config: Record<string, unknown>,
  ctx: EvalContext,
): ScoreOutcome {
  const m = ctx.metrics ?? {}
  switch (op) {
    case 'latency': {
      const max = num(config.max)
      if (m.latencyMs === undefined || max === undefined) return bool(true)
      return bool(m.latencyMs <= max, `latency ${m.latencyMs}ms exceeds ${max}ms`)
    }
    case 'token_count': {
      const tokens = m.totalTokens
      if (tokens === undefined) return bool(true)
      const min = num(config.min)
      const max = num(config.max)
      const ok = (min === undefined || tokens >= min) && (max === undefined || tokens <= max)
      return bool(ok, `token_count ${tokens} outside [${min ?? '-'}, ${max ?? '-'}]`)
    }
    case 'cost': {
      const max = num(config.max)
      if (m.costUsd === undefined || max === undefined) return bool(true)
      return bool(m.costUsd <= max, `cost $${m.costUsd} exceeds $${max}`)
    }
    default:
      return { score: 0, reason: `unsupported operational op: ${op}` }
  }
}
