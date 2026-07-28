import { diffManifests } from '@echostash/scan'
import type { McpToolSurface } from '@echostash/shared'
import { describe, expect, it } from 'vitest'
import { parseTarget, targetId } from './client'
import { diffBaseline, toBaseline, toManifest } from './manifest'

const tool = (name: string, description: string, inputSchema: unknown = {}) => ({
  name,
  title: null,
  description,
  inputSchema,
  outputSchema: null,
  annotations: null,
})

const surface = (tools: McpToolSurface['tools']): McpToolSurface => ({
  serverId: 'acme',
  serverName: 'acme',
  protocolVersion: '2026-07-28',
  fetchedAt: '2026-07-28T00:00:00.000Z',
  tools,
  ttlMs: null,
  cacheScope: null,
})

const baselineOf = (s: McpToolSurface) =>
  toBaseline(s, { score: 100, tokenBudget: 0, findingCounts: {} })

describe('parseTarget', () => {
  it('treats an http(s) url as an HTTP server', () => {
    expect(parseTarget('https://example.com/mcp')).toEqual({
      kind: 'http',
      url: 'https://example.com/mcp',
      headers: undefined,
    })
  })

  it('treats anything else as a command line', () => {
    expect(parseTarget('npx -y @acme/server --flag')).toEqual({
      kind: 'stdio',
      command: 'npx',
      args: ['-y', '@acme/server', '--flag'],
    })
  })

  it('rejects an empty target', () => {
    expect(() => parseTarget('   ')).toThrow(/empty/i)
  })

  it('produces a stable id for both kinds', () => {
    expect(targetId(parseTarget('https://x.dev/mcp'))).toBe('https://x.dev/mcp')
    expect(targetId(parseTarget('npx -y @acme/server'))).toBe('npx -y @acme/server')
  })
})

describe('toManifest', () => {
  it('round-trips through diffManifests with no changes when nothing moved', () => {
    const s = surface([tool('a', 'does a'), tool('b', 'does b')])
    const changeset = diffManifests(toManifest(s), toManifest(s))
    expect(changeset.summary.modified).toBe(0)
    expect(changeset.summary.new).toBe(0)
  })

  it('reports exactly one modified tool when one description is reworded', () => {
    const before = toManifest(surface([tool('a', 'does a'), tool('b', 'does b')]))
    const after = toManifest(surface([tool('a', 'does a differently'), tool('b', 'does b')]))
    const changeset = diffManifests(before, after)
    expect(changeset.summary.modified).toBe(1)
    expect(changeset.changes.find((c) => c.status === 'modified')?.name).toBe('a')
  })

  it('is order-independent — tool order from the server must not change the hash', () => {
    const a = toManifest(surface([tool('a', 'x'), tool('b', 'y')]))
    const b = toManifest(surface([tool('b', 'y'), tool('a', 'x')]))
    expect(a).toEqual(b)
  })
})

describe('diffBaseline', () => {
  it('separates a description change from a schema change', () => {
    const before = baselineOf(surface([tool('a', 'original', { type: 'object' })]))

    expect(
      diffBaseline(before, baselineOf(surface([tool('a', 'reworded', { type: 'object' })]))),
    ).toEqual([{ name: 'a', status: 'description-changed' }])

    expect(
      diffBaseline(
        before,
        baselineOf(surface([tool('a', 'original', { type: 'object', required: ['x'] })])),
      ),
    ).toEqual([{ name: 'a', status: 'schema-changed' }])
  })

  it('detects added and removed tools', () => {
    const before = baselineOf(surface([tool('a', 'x')]))
    const after = baselineOf(surface([tool('b', 'y')]))
    expect(diffBaseline(before, after)).toEqual([
      { name: 'a', status: 'removed' },
      { name: 'b', status: 'added' },
    ])
  })

  it('reports nothing when the surface is untouched', () => {
    const s = surface([tool('a', 'x'), tool('b', 'y')])
    expect(diffBaseline(baselineOf(s), baselineOf(s))).toEqual([])
  })
})
