import type { McpAuditReport, McpFinding, McpTokenBudget, McpToolSurface } from '@echostash/shared'
import { checkAnnotations } from './checks/annotations'
import { checkConfusable } from './checks/confusable'
import { checkDescription } from './checks/description'
import { checkNaming } from './checks/naming'
import { checkSchema } from './checks/schema'
import { scoreFindings } from './score'
import { estimateTokens } from './text'

export * from './text'
export * from './score'
export { confusablePairs, type ConfusablePair } from './checks/confusable'
export { checkSchema } from './checks/schema'

/** Past this the tool surface is a meaningful tax on every single request. */
export const TOKEN_BUDGET_WARN = 10_000

const SEVERITY_ORDER = { error: 0, warn: 1, info: 2 } as const

/**
 * What one tool costs the model's context on every request: its name, description, and the
 * full argument schema all ship in `tools/list`.
 */
export function toolTokens(tool: McpToolSurface['tools'][number]): number {
  const schema = tool.inputSchema === undefined ? '' : JSON.stringify(tool.inputSchema)
  return estimateTokens(`${tool.name}${tool.title ?? ''}${tool.description ?? ''}${schema}`)
}

export function tokenBudget(surface: McpToolSurface): McpTokenBudget {
  const perTool = surface.tools
    .map((t) => ({ tool: t.name, tokens: toolTokens(t) }))
    .sort((a, b) => b.tokens - a.tokens || a.tool.localeCompare(b.tool))
  return { total: perTool.reduce((sum, t) => sum + t.tokens, 0), perTool }
}

/**
 * Analyze an MCP tool surface. Pure: no I/O, no network, no model calls — which is what makes
 * it free to run, safe in CI, and trustworthy as a gate.
 */
export function analyze(surface: McpToolSurface): McpAuditReport {
  const budget = tokenBudget(surface)
  const findings: McpFinding[] = [
    ...checkConfusable(surface),
    ...checkNaming(surface),
    ...checkAnnotations(surface),
    ...surface.tools.flatMap((t) => [...checkDescription(t), ...checkSchema(t)]),
  ]

  if (budget.total > TOKEN_BUDGET_WARN) {
    findings.push({
      check: 'token-budget',
      severity: 'warn',
      message: `The tool surface costs ~${budget.total.toLocaleString('en-US')} tokens per request`,
      hint: `Heaviest: ${budget.perTool
        .slice(0, 3)
        .map((t) => `${t.tool} (~${t.tokens})`)
        .join(', ')}`,
    })
  }

  findings.sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.check.localeCompare(b.check) ||
      (a.tool ?? '').localeCompare(b.tool ?? ''),
  )

  return {
    serverId: surface.serverId,
    serverName: surface.serverName,
    protocolVersion: surface.protocolVersion,
    toolCount: surface.tools.length,
    score: scoreFindings(findings, surface.tools.length),
    tokenBudget: budget,
    findings,
  }
}
