import type { McpFinding, McpTool } from '@echostash/shared'

interface JsonSchemaish {
  type?: string
  description?: string
  enum?: unknown[]
  properties?: Record<string, JsonSchemaish>
  required?: string[]
  items?: JsonSchemaish
  maxItems?: number
  additionalProperties?: boolean | JsonSchemaish
}

const asSchema = (v: unknown): JsonSchemaish | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as JsonSchemaish) : null

/** Does the description enumerate allowed values in prose? e.g. "one of: read, write". */
const ENUMERATES = /\b(one of|must be either|either|can be|options?( are)?|valid values?)\b\s*:?/i

/**
 * Schema tightness. A free-form `string` where an enum belongs, an unbounded array, or an
 * undescribed parameter all push the model into guessing — the arguments are as much a prompt
 * as the description is.
 */
export function checkSchema(tool: McpTool): McpFinding[] {
  const findings: McpFinding[] = []
  const root = asSchema(tool.inputSchema)

  if (!root || (!root.properties && root.type !== 'object')) {
    // No schema at all is only worth flagging when the tool plainly takes arguments.
    if (!root) {
      findings.push({
        check: 'schema-missing',
        severity: 'warn',
        tool: tool.name,
        message: `"${tool.name}" has no inputSchema`,
        hint: 'Declare an object schema, even an empty one, so the model knows it takes no arguments.',
      })
    }
    return findings
  }

  const props = root.properties ?? {}
  const required = new Set(root.required ?? [])
  const names = Object.keys(props).sort()

  if (names.length > 0 && (root.required === undefined || root.required.length === 0)) {
    findings.push({
      check: 'schema-no-required',
      severity: 'warn',
      tool: tool.name,
      message: `"${tool.name}" declares ${names.length} parameter(s) but marks none required`,
      hint: 'If a parameter is mandatory, say so — otherwise the model may omit it.',
    })
  }

  if (root.additionalProperties === true) {
    findings.push({
      check: 'schema-open',
      severity: 'warn',
      tool: tool.name,
      message: `"${tool.name}" allows additionalProperties`,
      hint: 'Close the schema so invalid arguments fail fast instead of silently passing through.',
    })
  }

  for (const name of names) {
    const p = props[name]
    if (!p) continue

    if (!p.description?.trim()) {
      findings.push({
        check: 'param-undescribed',
        severity: required.has(name) ? 'error' : 'warn',
        tool: tool.name,
        message: `"${tool.name}.${name}" has no description`,
        hint: 'The model fills this argument from the description alone.',
      })
    }

    if (p.type === 'string' && !p.enum && ENUMERATES.test(p.description ?? '')) {
      findings.push({
        check: 'param-should-enum',
        severity: 'warn',
        tool: tool.name,
        message: `"${tool.name}.${name}" enumerates its options in prose but is an open string`,
        hint: 'Move the options into `enum` so invalid values are rejected, not just discouraged.',
      })
    }

    if (p.type === 'array' && p.maxItems === undefined) {
      findings.push({
        check: 'param-unbounded-array',
        severity: 'info',
        tool: tool.name,
        message: `"${tool.name}.${name}" is an array with no maxItems`,
        hint: 'Bound it so a model cannot request an unbounded amount of work.',
      })
    }
  }

  return findings
}
