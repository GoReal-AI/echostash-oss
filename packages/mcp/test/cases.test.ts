import { describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { addCase, readCasesFile, writeCasesFile } from '../src/cases'
import type { McpToolSurface } from '@echostash/shared'

const mockSurface: McpToolSurface = {
  serverId: 'acme-server',
  serverName: 'Acme Tools',
  protocolVersion: '2026-07-28',
  fetchedAt: new Date().toISOString(),
  tools: [
    {
      name: 'refund_order',
      title: 'Refund Order',
      description: 'Refund an order',
      inputSchema: {},
    },
    {
      name: 'search_docs',
      title: 'Search Docs',
      description: 'Search documentation',
      inputSchema: {},
    },
  ],
}

describe('MCP cases file', () => {
  it('reads and writes valid cases file with round-trip integrity', () => {
    const dir = mkdtempSync(join(tmpdir(), 'echostash-cases-test-'))
    const filePath = join(dir, 'mcp-cases.json')

    const file = {
      server: 'acme-server',
      cases: [
        {
          id: 'c1',
          query: 'cancel my order',
          expectTool: 'refund_order',
          source: 'manual' as const,
        },
        {
          id: 'c2',
          query: 'hello world',
          expectTool: null,
          source: 'manual' as const,
        },
      ],
    }

    writeCasesFile(filePath, file)
    const read = readCasesFile(filePath, mockSurface)
    expect(read).toEqual(file)

    rmSync(dir, { recursive: true, force: true })
  })

  it('rejects expectTool not present on the tool surface', () => {
    const dir = mkdtempSync(join(tmpdir(), 'echostash-cases-test-'))
    const filePath = join(dir, 'mcp-cases.json')

    const file = {
      server: 'acme-server',
      cases: [
        {
          id: 'c1',
          query: 'delete database',
          expectTool: 'non_existent_tool',
          source: 'manual' as const,
        },
      ],
    }

    writeCasesFile(filePath, file)
    expect(() => readCasesFile(filePath, mockSurface)).toThrow(
      /expectTool "non_existent_tool" does not exist/,
    )

    rmSync(dir, { recursive: true, force: true })
  })

  it('adds a new case via addCase', () => {
    const initial = {
      server: 'acme-server',
      cases: [
        {
          id: 'c1',
          query: 'cancel my order',
          expectTool: 'refund_order',
          source: 'manual' as const,
        },
      ],
    }

    const updated = addCase(
      initial,
      'acme-server',
      {
        query: 'how do I rotate a key?',
        expectTool: 'search_docs',
        source: 'manual',
      },
      mockSurface,
    )

    expect(updated.cases).toHaveLength(2)
    expect(updated.cases[1]).toEqual({
      id: 'c2',
      query: 'how do I rotate a key?',
      expectTool: 'search_docs',
      source: 'manual',
    })
  })
})
