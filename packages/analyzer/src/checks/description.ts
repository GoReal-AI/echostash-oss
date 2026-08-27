import type { McpFinding, McpTool } from '@echostash/shared'
import { estimateTokens } from '../text'

/** Under this, a description cannot be carrying enough signal to disambiguate. */
export const MIN_DESCRIPTION_CHARS = 40
/** Over this, the tool is eating context every single request. */
export const MAX_DESCRIPTION_TOKENS = 300

/**
 * Phrases that tell a model when to *stop* reaching for a tool. Their absence is the single
 * most common reason two plausible tools get confused: both say what they do, neither says
 * what it isn't for.
 */
const NEGATIVE_GUIDANCE =
  /\b(do not|don't|not for|never|instead|rather than|only when|unless|avoid|prefer)\b/i

export function checkDescription(tool: McpTool): McpFinding[] {
  const findings: McpFinding[] = []
  const desc = tool.description?.trim() ?? ''

  if (!desc) {
    findings.push({
      check: 'description-missing',
      severity: 'error',
      tool: tool.name,
      message: `"${tool.name}" has no description`,
      hint: 'This is the only thing the model reads when deciding whether to call it.',
    })
    return findings
  }

  if (desc.length < MIN_DESCRIPTION_CHARS) {
    findings.push({
      check: 'description-thin',
      severity: 'warn',
      tool: tool.name,
      message: `"${tool.name}" has a ${desc.length}-character description`,
      hint: 'Say what it does, what it returns, and when to use something else.',
    })
  }

  const tokens = estimateTokens(desc)
  if (tokens > MAX_DESCRIPTION_TOKENS) {
    findings.push({
      check: 'description-bloated',
      severity: 'warn',
      tool: tool.name,
      message: `"${tool.name}" spends ~${tokens} tokens on its description`,
      hint: 'Every request pays this. Trim to the decision-relevant facts.',
    })
  }

  if (!NEGATIVE_GUIDANCE.test(desc)) {
    findings.push({
      check: 'no-negative-guidance',
      severity: 'info',
      tool: tool.name,
      message: `"${tool.name}" never says when *not* to use it`,
      hint: 'A line like "not for X — use Y instead" is the cheapest disambiguation there is.',
    })
  }

  return findings
}
