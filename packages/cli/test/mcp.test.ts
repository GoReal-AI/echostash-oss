import { describe, expect, it } from 'vitest'
import { runMcp } from '../src/commands/mcp'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('CLI MCP audit command hardening', () => {
  it('rejects non-numeric NaN threshold', async () => {
    let errMessage = ''
    try {
      await runMcp(['audit', '--from-file', 'test.json', '--threshold', 'abc', '--check'])
    } catch (err) {
      errMessage = err instanceof Error ? err.message : String(err)
    }
    expect(errMessage).toContain('invalid --threshold: "abc" is not a valid number')
  })

  it('reports corrupt baseline explicitly instead of missing baseline', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-audit-test-'))
    const surfaceFile = join(dir, 'surface.json')
    const surfaceData = {
      serverId: 'test-server',
      serverName: 'test-server',
      protocolVersion: '2024-11-05',
      fetchedAt: new Date().toISOString(),
      tools: [
        {
          name: 'get_user',
          description: 'fetch user details',
          inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        },
      ],
    }
    writeFileSync(surfaceFile, JSON.stringify(surfaceData))

    // Write corrupt baseline
    const baselineFile = join(dir, 'mcp-baseline.test_server.json')
    writeFileSync(baselineFile, '{ corrupt json invalid syntax')

    const code = await runMcp(['audit', '--from-file', surfaceFile, '--dir', dir, '--check'])
    expect(code).toBe(1)

    rmSync(dir, { recursive: true, force: true })
  })
})
