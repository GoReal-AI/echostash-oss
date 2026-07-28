import type { McpFinding, McpToolSurface } from '@echostash/shared'

/** Names that read as mutating. Used only to raise the stakes on a missing hint. */
const MUTATING = /\b(delete|remove|drop|destroy|create|update|write|send|post|patch|purge|reset)\b/i

/**
 * Behavioural hints and (as of the 2026-07-28 revision) list cache hints.
 *
 * These aren't conformance checks — a server without them is still valid. They're design
 * checks: a client that can't tell a read from a destructive write has to ask the user about
 * everything, and a surface with no cache hints re-sends itself on every call.
 */
export function checkAnnotations(surface: McpToolSurface): McpFinding[] {
  const findings: McpFinding[] = []

  for (const tool of surface.tools) {
    const a = tool.annotations
    const looksMutating = MUTATING.test(tool.name) || MUTATING.test(tool.description ?? '')

    if (a?.readOnlyHint == null && a?.destructiveHint == null) {
      findings.push({
        check: 'annotations-missing',
        severity: looksMutating ? 'warn' : 'info',
        tool: tool.name,
        message: `"${tool.name}" declares neither readOnlyHint nor destructiveHint`,
        hint: looksMutating
          ? 'This one reads as mutating — clients need the hint to gate it behind confirmation.'
          : 'Let clients skip confirmation prompts for reads.',
      })
    }
  }

  if (surface.ttlMs == null && surface.cacheScope == null) {
    findings.push({
      check: 'cache-hints-missing',
      severity: 'info',
      message: 'tools/list returned no ttlMs / cacheScope',
      hint: 'The 2026-07-28 revision lets clients cache the tool surface — without hints they refetch.',
    })
  }

  return findings
}
