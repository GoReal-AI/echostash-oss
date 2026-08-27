import { type Manifest, hashValue } from '@echostash/scan'
import type { McpBaseline, McpBaselineTool, McpToolSurface } from '@echostash/shared'

/**
 * Hash a tool the same way the rest of Echostash hashes prompts, keeping the two-hash split:
 * `contentHash` covers what the model *reads* (name + description), `configHash` covers the
 * argument contract. A reworded description is a content change; a schema edit is a config
 * change. Same distinction the prompt registry already makes.
 */
export function hashTool(tool: McpToolSurface['tools'][number]): McpBaselineTool {
  return {
    name: tool.name,
    contentHash: hashValue({ name: tool.name, description: tool.description ?? '' }),
    configHash: hashValue(tool.inputSchema ?? {}),
  }
}

/**
 * Map a tool surface onto `@echostash/scan`'s manifest. That package is deliberately
 * discovery-agnostic, so this one adapter buys us the whole diff + store layer for free:
 * one server is one "file", one tool is one "prompt".
 */
export function toManifest(surface: McpToolSurface): Manifest {
  const tools = [...surface.tools].sort((a, b) => a.name.localeCompare(b.name))
  const prompts = tools.map((t) => {
    const h = hashTool(t)
    return { name: t.name, promptHash: hashValue([h.contentHash, h.configHash]) }
  })

  return {
    source: surface.serverId,
    gitSha: null,
    files: {
      [surface.serverId]: {
        relPath: surface.serverId,
        fileHash: hashValue(prompts),
        prompts,
      },
    },
  }
}

/** Build the committed baseline record for a surface + its audit result. */
export function toBaseline(
  surface: McpToolSurface,
  opts: { score: number; tokenBudget: number; findingCounts: Record<string, number> },
): McpBaseline {
  return {
    version: 1,
    serverId: surface.serverId,
    serverName: surface.serverName,
    protocolVersion: surface.protocolVersion,
    createdAt: surface.fetchedAt,
    score: opts.score,
    tokenBudget: opts.tokenBudget,
    findingCounts: opts.findingCounts,
    tools: [...surface.tools].sort((a, b) => a.name.localeCompare(b.name)).map(hashTool),
  }
}

export type ToolChangeStatus = 'added' | 'removed' | 'description-changed' | 'schema-changed'

export interface ToolChange {
  name: string
  status: ToolChangeStatus
}

/**
 * What changed between a committed baseline and the surface we just read. Reported per tool,
 * because "the score dropped 4 points" is useless and "`search_docs` changed its description"
 * is actionable.
 */
export function diffBaseline(previous: McpBaseline, current: McpBaseline): ToolChange[] {
  const before = new Map(previous.tools.map((t) => [t.name, t]))
  const after = new Map(current.tools.map((t) => [t.name, t]))
  const changes: ToolChange[] = []

  for (const [name, t] of after) {
    const prev = before.get(name)
    if (!prev) {
      changes.push({ name, status: 'added' })
      continue
    }
    if (prev.contentHash !== t.contentHash) changes.push({ name, status: 'description-changed' })
    if (prev.configHash !== t.configHash) changes.push({ name, status: 'schema-changed' })
  }
  for (const name of before.keys()) {
    if (!after.has(name)) changes.push({ name, status: 'removed' })
  }

  return changes.sort((a, b) => a.name.localeCompare(b.name) || a.status.localeCompare(b.status))
}
