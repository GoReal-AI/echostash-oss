import type { McpToolSurface } from '@echostash/shared'
import { describe, expect, it } from 'vitest'
import { buildHeldOutGenPrompt, generateCasesForSurface } from './gen-cases'

const mockSurface: McpToolSurface = {
  serverId: 'sqlite-server',
  serverName: 'SQLite MCP Server',
  protocolVersion: '2024-11-05',
  fetchedAt: '2026-08-29T20:00:00Z',
  tools: [
    {
      name: 'query_db',
      description: 'SuperSecretDatabaseDescriptionNotToExposeInPrompt',
      inputSchema: {
        type: 'object',
        properties: { sql: { type: 'string' } },
        required: ['sql'],
      },
    },
    {
      name: 'list_tables',
      description: 'AnotherProprietaryDescriptionWithUniqueKeywords',
      inputSchema: { type: 'object' },
    },
  ],
}

describe('mcp/gen-cases', () => {
  describe('buildHeldOutGenPrompt', () => {
    it('withholds descriptions from generation prompt (held-out invariant)', () => {
      const prompt = buildHeldOutGenPrompt(mockSurface.tools)

      // Must NOT contain the descriptions
      expect(prompt).not.toContain('SuperSecretDatabaseDescriptionNotToExposeInPrompt')
      expect(prompt).not.toContain('AnotherProprietaryDescriptionWithUniqueKeywords')

      // Must contain tool names and schemas
      expect(prompt).toContain('query_db')
      expect(prompt).toContain('list_tables')
      expect(prompt).toContain('sql')
    })
  })

  describe('generateCasesForSurface', () => {
    it('generates reviewable case file using fallback when no completeFn provided', async () => {
      const result = await generateCasesForSurface(mockSurface)

      expect(result.version).toBe(1)
      expect(result.serverId).toBe('sqlite-server')
      expect(result.comment).toContain('Generated evaluation cases')
      expect(result.cases.length).toBeGreaterThan(0)
      for (const c of result.cases) {
        expect(c.source).toBe('generated')
        expect(c.id).toBeDefined()
        expect(c.query).toBeDefined()
      }
    })

    it('parses LLM response into structured cases', async () => {
      const mockComplete = async () =>
        JSON.stringify([
          { id: 'c1', query: 'Show me all customers from the database', expectedTool: 'query_db' },
          { id: 'c2', query: 'What tables exist in this sqlite file?', expectedTool: 'list_tables' },
          { id: 'c3', query: 'Write a poem about dogs', expectedTool: null },
        ])

      const result = await generateCasesForSurface(mockSurface, mockComplete)

      expect(result.version).toBe(1)
      expect(result.serverId).toBe('sqlite-server')
      expect(result.cases).toHaveLength(3)
      expect(result.cases[0]?.expectedTool).toBe('query_db')
      expect(result.cases[1]?.expectedTool).toBe('list_tables')
      expect(result.cases[2]?.expectedTool).toBeNull()
      expect(result.cases[0]?.source).toBe('generated')
    })
  })
})
