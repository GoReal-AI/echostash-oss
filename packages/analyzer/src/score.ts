import type { McpFinding, McpSeverity } from '@echostash/shared'

export const PENALTY: Record<McpSeverity, number> = { error: 12, warn: 4, info: 1 }

/**
 * The Tool Surface Score, 0-100. This is the number the CI gate guards, so it has to be
 * **stable** — same surface in, same score out, no clock and no iteration-order dependence.
 *
 * Three weight classes, because they mean different things:
 *
 * - **Surface-level findings** (mixed casing, missing cache hints) count once, at full weight.
 * - **Per-tool errors** count at full weight too. A tool with no description is a defect in
 *   absolute terms; it doesn't become less broken because forty other tools are fine, so
 *   averaging it away would let a large surface hide real damage.
 * - **Per-tool warnings and info** are averaged across the surface. These measure *proportion*
 *   of sloppiness, so a 40-tool server shouldn't be punished harder than a 4-tool one for the
 *   same ratio of problems.
 */
export function scoreFindings(findings: McpFinding[], toolCount: number): number {
  let surface = 0
  let errors = 0
  let soft = 0

  for (const f of findings) {
    const penalty = PENALTY[f.severity]
    if (!f.tool) surface += penalty
    else if (f.severity === 'error') errors += penalty
    else soft += penalty
  }

  const averagedSoft = toolCount > 0 ? soft / toolCount : soft
  const score = 100 - surface - errors - averagedSoft
  return Math.max(0, Math.min(100, Number(score.toFixed(1))))
}
