import type { AssertionOp } from '@echostash/shared'
import { bool, type EvalContext, type ScoreOutcome } from './types'

export function scoreToolSelection(
  op: AssertionOp,
  config: Record<string, unknown>,
  ctx: EvalContext,
): ScoreOutcome {
  if (op !== 'selected_tool') {
    return bool(false, `unknown tool_selection op: ${op}`)
  }

  const expected = (config.tool ?? config.value ?? ctx.expected) as string | null | undefined
  if (expected === undefined) {
    return bool(false, 'no expected tool specified in scorer config or context')
  }

  const actual = ctx.toolChoice?.name ?? null
  const pass = actual === expected
  return bool(
    pass,
    pass ? undefined : `expected tool "${expected ?? 'null'}", got "${actual ?? 'null'}"`,
  )
}
