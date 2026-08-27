import { z } from 'zod'
import { Timestamp } from './common'

/**
 * An MCP tool definition. The `name`, `description`, and `inputSchema` are the only things a
 * model sees when deciding which tool to call and how to fill its arguments — which makes them
 * prompts, shipped through PRs, with nobody evaluating the effect of an edit.
 */
export const McpTool = z.object({
  name: z.string(),
  title: z.string().nullish(),
  description: z.string().default(''),
  /** JSON Schema for the tool's arguments. Kept opaque — the analyzer walks it structurally. */
  inputSchema: z.unknown().default({}),
  outputSchema: z.unknown().nullish(),
  annotations: z
    .object({
      readOnlyHint: z.boolean().nullish(),
      destructiveHint: z.boolean().nullish(),
      idempotentHint: z.boolean().nullish(),
      openWorldHint: z.boolean().nullish(),
    })
    .nullish(),
})
export type McpTool = z.infer<typeof McpTool>

/** Everything one `tools/list` call tells us about a server. */
export const McpToolSurface = z.object({
  /** Stable id for this server — the manifest key. Derived from the target (url or command). */
  serverId: z.string(),
  serverName: z.string(),
  /** MCP protocol revision the server negotiated, e.g. "2026-07-28". */
  protocolVersion: z.string().nullable(),
  fetchedAt: Timestamp,
  tools: z.array(McpTool),
  /** `tools/list` cache hints (added in the 2026-07-28 revision). */
  ttlMs: z.number().nullish(),
  cacheScope: z.string().nullish(),
})
export type McpToolSurface = z.infer<typeof McpToolSurface>

export const McpSeverity = z.enum(['error', 'warn', 'info'])
export type McpSeverity = z.infer<typeof McpSeverity>

/** One analyzer finding. `tool`/`relatedTool` are set when a finding has an address. */
export const McpFinding = z.object({
  check: z.string(),
  severity: McpSeverity,
  message: z.string(),
  tool: z.string().nullish(),
  relatedTool: z.string().nullish(),
  hint: z.string().nullish(),
})
export type McpFinding = z.infer<typeof McpFinding>

/** How much of the model's context the tool surface costs, in estimated tokens. */
export const McpTokenBudget = z.object({
  total: z.number(),
  perTool: z.array(z.object({ tool: z.string(), tokens: z.number() })),
})
export type McpTokenBudget = z.infer<typeof McpTokenBudget>

export const McpAuditReport = z.object({
  serverId: z.string(),
  serverName: z.string(),
  protocolVersion: z.string().nullable(),
  toolCount: z.number(),
  /** 0-100. Deterministic: same surface in, same score out. */
  score: z.number(),
  tokenBudget: McpTokenBudget,
  findings: z.array(McpFinding),
})
export type McpAuditReport = z.infer<typeof McpAuditReport>

/**
 * The committed baseline (`.echostash/mcp-baseline.json`) the CI gate compares against.
 * Per-tool hashes keep the two-hash split: a reworded description is a *content* change, an
 * argument-schema change is a *config* change.
 */
export const McpBaselineTool = z.object({
  name: z.string(),
  contentHash: z.string(),
  configHash: z.string(),
})
export type McpBaselineTool = z.infer<typeof McpBaselineTool>

export const McpBaseline = z.object({
  version: z.literal(1).default(1),
  serverId: z.string(),
  serverName: z.string(),
  protocolVersion: z.string().nullable(),
  createdAt: Timestamp,
  score: z.number(),
  tokenBudget: z.number(),
  findingCounts: z.record(z.number()).default({}),
  tools: z.array(McpBaselineTool),
})
export type McpBaseline = z.infer<typeof McpBaseline>
