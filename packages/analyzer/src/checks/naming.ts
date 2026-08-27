import type { McpFinding, McpToolSurface } from '@echostash/shared'

/** Verbs that describe nothing. A tool called `run` tells the model exactly nothing. */
const GENERIC = new Set([
  'get',
  'run',
  'do',
  'execute',
  'query',
  'call',
  'fetch',
  'handle',
  'process',
])

type Casing = 'snake' | 'camel' | 'kebab' | 'other'

function casing(name: string): Casing {
  if (/^[a-z0-9]+(_[a-z0-9]+)+$/.test(name)) return 'snake'
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(name)) return 'kebab'
  if (/^[a-z][a-zA-Z0-9]*$/.test(name) && /[A-Z]/.test(name)) return 'camel'
  return 'other'
}

export function checkNaming(surface: McpToolSurface): McpFinding[] {
  const findings: McpFinding[] = []

  for (const tool of surface.tools) {
    const head = tool.name.split(/[_\-]/)[0]?.toLowerCase() ?? ''
    if (GENERIC.has(tool.name.toLowerCase()) || (GENERIC.has(head) && tool.name.length <= 8)) {
      findings.push({
        check: 'name-generic',
        severity: 'warn',
        tool: tool.name,
        message: `"${tool.name}" is a generic name`,
        hint: 'Name the thing it acts on, not just the action.',
      })
    }
  }

  // Casing consistency is a surface-level property — mixed conventions make the whole set
  // harder to pattern-match, so it's reported once rather than per tool.
  const counts = new Map<Casing, number>()
  for (const tool of surface.tools) {
    const c = casing(tool.name)
    if (c === 'other') continue
    counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  if (counts.size > 1) {
    const breakdown = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([c, n]) => `${c}:${n}`)
      .join(', ')
    findings.push({
      check: 'name-casing-mixed',
      severity: 'warn',
      message: `Tool names mix casing conventions (${breakdown})`,
      hint: 'Pick one convention across the surface.',
    })
  }

  return findings
}
