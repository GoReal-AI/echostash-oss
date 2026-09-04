import type { McpFinding } from '@echostash/shared'

export interface BlastRadiusScope {
  changedTools: string[]
  neighborTools: string[]
  evalTools: string[] // changedTools ∪ neighborTools
  skippedTools: string[]
}

/**
 * Calculates the blast radius for incremental re-evaluation:
 * Changed tools + their confusable neighbors (from analyzer findings).
 */
export function calculateBlastRadius(
  changedTools: string[],
  allTools: string[],
  findings: McpFinding[],
): BlastRadiusScope {
  const changedSet = new Set(changedTools)
  const neighborSet = new Set<string>()

  // Find neighbors connected via confusable or relatedTool findings
  for (const f of findings) {
    if (f.tool && f.relatedTool) {
      if (changedSet.has(f.tool) && !changedSet.has(f.relatedTool)) {
        neighborSet.add(f.relatedTool)
      } else if (changedSet.has(f.relatedTool) && !changedSet.has(f.tool)) {
        neighborSet.add(f.tool)
      }
    }
  }

  const evalSet = new Set([...changedSet, ...neighborSet])
  const skippedTools = allTools.filter((t) => !evalSet.has(t))

  return {
    changedTools: Array.from(changedSet).sort(),
    neighborTools: Array.from(neighborSet).sort(),
    evalTools: Array.from(evalSet).sort(),
    skippedTools: skippedTools.sort(),
  }
}

/**
 * Compares model and protocol version pinning.
 * Returns null if comparable, or an error reason string if mismatched.
 */
export function verifyPinning(
  current: { selectorModel?: string | null; protocolVersion?: string | null },
  previous: { selectorModel?: string | null; protocolVersion?: string | null },
): string | null {
  if (
    current.selectorModel &&
    previous.selectorModel &&
    current.selectorModel !== previous.selectorModel
  ) {
    return `selector model changed (${previous.selectorModel} → ${current.selectorModel}); selection accuracy numbers are incomparable`
  }
  if (
    current.protocolVersion &&
    previous.protocolVersion &&
    current.protocolVersion !== previous.protocolVersion
  ) {
    return `protocol revision changed (${previous.protocolVersion} → ${current.protocolVersion}); baseline is incomparable`
  }
  return null
}
