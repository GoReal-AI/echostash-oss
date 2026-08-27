import type { McpFinding, McpToolSurface } from '@echostash/shared'
import { descriptionSimilarity, nameSimilarity } from '../text'

/** Above this, two descriptions are similar enough that a model has to guess. */
export const CONFUSABLE_DESCRIPTION = 0.55
export const CONFUSABLE_NAME = 0.8

export interface ConfusablePair {
  a: string
  b: string
  descriptionSimilarity: number
  nameSimilarity: number
}

/**
 * Find tool pairs a model is likely to mix up.
 *
 * This also supplies the blast radius for the selection eval: editing tool A's description can
 * change whether A steals traffic from B, so re-evaluating only the changed tool misses the
 * regression it caused in its neighbours.
 */
export function confusablePairs(surface: McpToolSurface): ConfusablePair[] {
  const pairs: ConfusablePair[] = []
  const tools = surface.tools
  for (let i = 0; i < tools.length; i++) {
    for (let j = i + 1; j < tools.length; j++) {
      const a = tools[i]
      const b = tools[j]
      if (!a || !b) continue
      const ds = descriptionSimilarity(a.description, b.description)
      const ns = Number(nameSimilarity(a.name, b.name).toFixed(4))
      if (ds >= CONFUSABLE_DESCRIPTION || ns >= CONFUSABLE_NAME) {
        pairs.push({ a: a.name, b: b.name, descriptionSimilarity: ds, nameSimilarity: ns })
      }
    }
  }
  // Sort so the report is stable and the worst offenders lead.
  return pairs.sort(
    (x, y) =>
      y.descriptionSimilarity - x.descriptionSimilarity ||
      y.nameSimilarity - x.nameSimilarity ||
      x.a.localeCompare(y.a) ||
      x.b.localeCompare(y.b),
  )
}

export function checkConfusable(surface: McpToolSurface): McpFinding[] {
  return confusablePairs(surface).map((p) => {
    const byName = p.nameSimilarity >= CONFUSABLE_NAME
    return {
      check: 'confusable-tools',
      severity: p.descriptionSimilarity >= 0.75 || p.nameSimilarity >= 0.9 ? 'error' : 'warn',
      tool: p.a,
      relatedTool: p.b,
      message: byName
        ? `"${p.a}" and "${p.b}" have near-identical names (${p.nameSimilarity.toFixed(2)} similar)`
        : `"${p.a}" and "${p.b}" have ${(p.descriptionSimilarity * 100).toFixed(0)}% similar descriptions`,
      hint: 'State what each one is for and, explicitly, when to use the other instead.',
    } satisfies McpFinding
  })
}
