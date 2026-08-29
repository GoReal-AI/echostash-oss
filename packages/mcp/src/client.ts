import type { McpTool, McpToolSurface } from '@echostash/shared'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

/** Where to reach the server: an HTTP endpoint, or a command we spawn and speak stdio to. */
export type McpTarget =
  | { kind: 'http'; url: string; headers?: Record<string, string> }
  | {
      kind: 'stdio'
      command: string
      args: string[]
      /** Extra variables handed to the spawned server (on top of the safe default set). */
      env?: Record<string, string>
      /**
       * Hand the server our *entire* environment. Off by default: an audited server is usually
       * somebody else's code, and it must not inherit provider keys / tokens by accident.
       */
      inheritEnv?: boolean
    }

/**
 * Parse a CLI target. A bare `http(s)://` URL is an HTTP server; anything else is a command
 * line we spawn (`npx -y @acme/server --flag`).
 */
export function parseTarget(input: string, headers?: Record<string, string>): McpTarget {
  const trimmed = input.trim()
  if (/^https?:\/\//i.test(trimmed)) return { kind: 'http', url: trimmed, headers }
  const [command, ...args] = trimmed.split(/\s+/).filter(Boolean)
  if (!command) throw new Error('empty MCP target')
  return { kind: 'stdio', command, args }
}

/** A stable, filesystem-safe id for a target — the manifest key. */
export function targetId(target: McpTarget): string {
  return target.kind === 'http' ? target.url : [target.command, ...target.args].join(' ')
}

const CLIENT_INFO = { name: 'echostash-mcp-audit', version: '0.1.0' }

/**
 * Environment for a spawned stdio server.
 *
 * Defaults to the MCP SDK's allow-list (`PATH`, `HOME`, `SHELL`, … — what a process needs to
 * start) plus anything explicitly passed in `target.env`. The full parent environment is only
 * forwarded when `inheritEnv` is set, so `echostash mcp audit --command "npx -y @acme/server"`
 * never leaks `OPENAI_API_KEY`, `NPM_TOKEN`, etc. into code we didn't write.
 */
export function stdioEnv(
  target: Extract<McpTarget, { kind: 'stdio' }>,
  parent: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const base: Record<string, string> = {}
  if (target.inheritEnv) {
    for (const [k, v] of Object.entries(parent)) if (v !== undefined) base[k] = v
  } else {
    Object.assign(base, getDefaultEnvironment())
  }
  return { ...base, ...(target.env ?? {}) }
}

/**
 * Read a server's complete tool surface.
 *
 * **Read-only by construction**: we call `tools/list` and nothing else, never `tools/call`.
 * Auditing somebody's server must not have side effects.
 */
export async function fetchToolSurface(target: McpTarget): Promise<McpToolSurface> {
  const client = new Client(CLIENT_INFO, { capabilities: {} })
  const transport =
    target.kind === 'http'
      ? new StreamableHTTPClientTransport(new URL(target.url), {
          requestInit: target.headers ? { headers: target.headers } : undefined,
        })
      : new StdioClientTransport({
          command: target.command,
          args: target.args,
          env: stdioEnv(target),
        })

  try {
    await client.connect(transport)
  } catch (err) {
    throw new Error(`could not connect to the MCP server (${targetId(target)}): ${describe(err)}`, {
      cause: err,
    })
  }

  try {
    const tools: McpTool[] = []
    let cursor: string | undefined
    let ttlMs: number | null = null
    let cacheScope: string | null = null

    // Paginate until the server stops handing back a cursor.
    do {
      const page = await client.listTools(cursor ? { cursor } : undefined)
      for (const t of page.tools) {
        tools.push({
          name: t.name,
          title: (t as { title?: string }).title ?? t.annotations?.title ?? null,
          description: t.description ?? '',
          inputSchema: t.inputSchema ?? {},
          outputSchema: t.outputSchema ?? null,
          annotations: t.annotations
            ? {
                readOnlyHint: t.annotations.readOnlyHint ?? null,
                destructiveHint: t.annotations.destructiveHint ?? null,
                idempotentHint: t.annotations.idempotentHint ?? null,
                openWorldHint: t.annotations.openWorldHint ?? null,
              }
            : null,
        })
      }
      // Cache hints arrive as extra top-level fields (2026-07-28 revision).
      const extra = page as Record<string, unknown>
      if (typeof extra.ttlMs === 'number') ttlMs = extra.ttlMs
      if (typeof extra.cacheScope === 'string') cacheScope = extra.cacheScope
      cursor = typeof extra.nextCursor === 'string' ? extra.nextCursor : undefined
    } while (cursor)

    const negotiated =
      transport instanceof StreamableHTTPClientTransport
        ? (transport.protocolVersion ?? null)
        : null

    return {
      serverId: targetId(target),
      serverName: client.getServerVersion()?.name ?? targetId(target),
      protocolVersion: negotiated,
      fetchedAt: new Date().toISOString(),
      tools,
      ttlMs,
      cacheScope,
    }
  } finally {
    await client.close().catch(() => {})
  }
}

function describe(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/401|403|unauthor/i.test(msg)) return `${msg} — the server requires authentication`
  return msg
}
