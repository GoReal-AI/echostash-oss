import type { McpFinding, McpSeverity } from '@echostash/shared'

export const PENALTY: Record<McpSeverity, number> = { error: 12, warn: 4, info: 1 }

/**
 * The Tool Surface Score, 0-100. This is the number the CI gate guards, so it has to be
 * **stable** — same surface in, same score out, no clock and no iteration-order dependence.
 *
 * Every tool gets its own score (100 minus the penalties of the findings on it, floored at 0),
 * and the surface score is the **mean of the tool scores** minus the surface-level findings
 * (mixed casing, missing cache hints), which count once at full weight.
 *
 * Why per-tool, then average, rather than a flat sum: real servers routinely carry dozens of
 * findings (undescribed parameters, mostly). A flat sum of 12 per error floored the score at 0
 * for reference servers like `server-filesystem`, and a surface at 0 can never regress, which
 * left the gate blind exactly where it mattered. Averaging keeps the number informative on
 * every surface, and because any new finding on any tool lowers the mean, a zero-threshold
 * gate still catches every regression. The per-tool diff names the damaged tool.
 */
export function scoreFindings(findings: McpFinding[], toolCount: number): number {
  let surface = 0
  const perTool = new Map<string, number>()

  for (const f of findings) {
    const penalty = PENALTY[f.severity]
    if (!f.tool) surface += penalty
    else perTool.set(f.tool, (perTool.get(f.tool) ?? 0) + penalty)
  }

  // Tools without findings score 100. Tools we only know from findings (toolCount lower than the
  // distinct names, which should not happen) are still counted so nothing is silently dropped.
  const n = Math.max(toolCount, perTool.size)
  let sum = 0
  for (const p of perTool.values()) sum += Math.max(0, 100 - p)
  sum += (n - perTool.size) * 100
  const mean = n > 0 ? sum / n : 100

  const score = mean - surface
  return Math.max(0, Math.min(100, Number(score.toFixed(1))))
}
