import type { McpToolSurface } from '@echostash/shared'
import { describe, expect, it } from 'vitest'
import { analyze, confusablePairs, tokenBudget } from './index'
import { scoreFindings } from './score'
import { descriptionSimilarity, estimateTokens, nameSimilarity } from './text'

const surface = (tools: McpToolSurface['tools'], extra: Partial<McpToolSurface> = {}) =>
  ({
    serverId: 'test',
    serverName: 'test',
    protocolVersion: '2026-07-28',
    fetchedAt: '2026-07-28T00:00:00.000Z',
    tools,
    ttlMs: null,
    cacheScope: null,
    ...extra,
  }) satisfies McpToolSurface

/** A surface that does everything right — used to prove the analyzer isn't just always angry. */
const GOOD = surface([
  {
    name: 'search_documents',
    title: null,
    description:
      'Full-text search over the customer-facing help centre articles. Returns article titles and URLs. Do not use this for source code — use search_source_code instead.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'The natural-language search query.' } },
      required: ['query'],
      additionalProperties: false,
    },
    outputSchema: null,
    annotations: {
      readOnlyHint: true,
      destructiveHint: null,
      idempotentHint: null,
      openWorldHint: null,
    },
  },
])

describe('text similarity', () => {
  it('scores identical descriptions as maximally confusable', () => {
    expect(descriptionSimilarity('search the docs', 'search the docs')).toBeGreaterThan(0.9)
  })

  it('scores unrelated descriptions as low', () => {
    expect(descriptionSimilarity('delete a customer record', 'render a chart as png')).toBeLessThan(
      0.2,
    )
  })

  it('ignores stopwords when comparing meaning', () => {
    // Same content words, different filler — should still read as confusable.
    expect(
      descriptionSimilarity('Search the documents', 'Use this to search your documents'),
    ).toBeGreaterThan(0.5)
  })

  it('detects near-identical names', () => {
    expect(nameSimilarity('get_user', 'get_users')).toBeGreaterThan(0.85)
    expect(nameSimilarity('get_user', 'render_chart')).toBeLessThan(0.4)
  })

  it('estimates tokens monotonically', () => {
    expect(estimateTokens('')).toBe(0)
    expect(estimateTokens('a'.repeat(400))).toBe(100)
  })
})

describe('confusable pairs', () => {
  it('flags two tools that describe the same job', () => {
    const s = surface([
      {
        name: 'search_docs',
        title: null,
        description: 'Search the documentation for a query and return matching pages.',
        inputSchema: { type: 'object', properties: {}, required: [] },
        outputSchema: null,
        annotations: null,
      },
      {
        name: 'find_docs',
        title: null,
        description: 'Search the documentation for a query and return matching pages.',
        inputSchema: { type: 'object', properties: {}, required: [] },
        outputSchema: null,
        annotations: null,
      },
    ])
    const pairs = confusablePairs(s)
    expect(pairs).toHaveLength(1)
    expect(pairs[0]?.descriptionSimilarity).toBeGreaterThan(0.9)
  })

  it('does not flag genuinely distinct tools', () => {
    const s = surface([
      {
        name: 'refund_order',
        title: null,
        description: 'Issue a monetary refund against a completed order.',
        inputSchema: { type: 'object', properties: {}, required: [] },
        outputSchema: null,
        annotations: null,
      },
      {
        name: 'render_chart',
        title: null,
        description: 'Produce a PNG bar chart from a series of numeric datapoints.',
        inputSchema: { type: 'object', properties: {}, required: [] },
        outputSchema: null,
        annotations: null,
      },
    ])
    expect(confusablePairs(s)).toHaveLength(0)
  })
})

describe('token budget', () => {
  it('sorts tools by weight, heaviest first', () => {
    const s = surface([
      {
        name: 'small',
        title: null,
        description: 'x',
        inputSchema: {},
        outputSchema: null,
        annotations: null,
      },
      {
        name: 'large',
        title: null,
        description: 'y'.repeat(1000),
        inputSchema: {},
        outputSchema: null,
        annotations: null,
      },
    ])
    const budget = tokenBudget(s)
    expect(budget.perTool[0]?.tool).toBe('large')
    expect(budget.total).toBeGreaterThan(250)
  })
})

describe('score', () => {
  it('averages per-tool warnings so big surfaces are not double-punished', () => {
    const perTool = [
      { check: 'a', severity: 'warn' as const, message: 'm', tool: 't1' },
      { check: 'a', severity: 'warn' as const, message: 'm', tool: 't2' },
    ]
    // Two tools, one warn each → same score as one tool with one warn.
    expect(scoreFindings(perTool, 2)).toBe(scoreFindings(perTool.slice(0, 1), 1))
  })

  it('does NOT average errors — a broken tool stays broken on a big surface', () => {
    const oneError = [{ check: 'a', severity: 'error' as const, message: 'm', tool: 't1' }]
    // Same absolute hit whether the server has 2 tools or 40.
    expect(scoreFindings(oneError, 2)).toBe(scoreFindings(oneError, 40))
    expect(scoreFindings(oneError, 40)).toBe(88)
  })

  it('counts surface-level findings once at full weight', () => {
    expect(scoreFindings([{ check: 'a', severity: 'error', message: 'm' }], 10)).toBe(88)
  })

  it('clamps to 0..100', () => {
    const many = Array.from({ length: 50 }, () => ({
      check: 'a',
      severity: 'error' as const,
      message: 'm',
    }))
    expect(scoreFindings(many, 1)).toBe(0)
    expect(scoreFindings([], 1)).toBe(100)
  })
})

describe('analyze', () => {
  it('is deterministic — same surface in, identical report out', () => {
    expect(JSON.stringify(analyze(GOOD))).toBe(JSON.stringify(analyze(GOOD)))
  })

  it('gives a well-designed surface a high score', () => {
    const report = analyze(GOOD)
    expect(report.score).toBeGreaterThanOrEqual(90)
    expect(report.findings.filter((f) => f.severity === 'error')).toHaveLength(0)
  })

  it('catches the full set of problems on a deliberately bad surface', () => {
    const bad = surface([
      {
        // snake_case + a generic head verb, against getData's camelCase below
        name: 'run_job',
        title: null,
        description: '',
        inputSchema: {
          type: 'object',
          properties: { mode: { type: 'string', description: 'One of: fast, slow' } },
          required: ['mode'],
          additionalProperties: true,
        },
        outputSchema: null,
        annotations: null,
      },
      {
        name: 'getData',
        title: null,
        description: 'Gets data.',
        inputSchema: {
          type: 'object',
          properties: { ids: { type: 'array', description: 'ids' } },
          required: [],
        },
        outputSchema: null,
        annotations: null,
      },
    ])
    const checks = new Set(analyze(bad).findings.map((f) => f.check))
    expect(checks).toContain('description-missing')
    expect(checks).toContain('description-thin')
    expect(checks).toContain('name-generic')
    expect(checks).toContain('name-casing-mixed')
    expect(checks).toContain('param-should-enum')
    expect(checks).toContain('param-unbounded-array')
    expect(checks).toContain('schema-open')
    expect(checks).toContain('schema-no-required')
    expect(checks).toContain('cache-hints-missing')
    // Relative separation is the meaningful assertion — a magic threshold would just pin
    // whatever the weights happen to be today.
    expect(analyze(bad).score).toBeLessThan(analyze(GOOD).score - 20)
  })

  it('orders findings by severity so the report leads with what matters', () => {
    const report = analyze(
      surface([
        {
          name: 'x',
          title: null,
          description: '',
          inputSchema: { type: 'object', properties: {}, required: [] },
          outputSchema: null,
          annotations: null,
        },
      ]),
    )
    const severities = report.findings.map((f) => f.severity)
    expect(severities).toEqual([...severities].sort((a, b) => (a === 'error' ? -1 : 0)))
    expect(report.findings[0]?.severity).toBe('error')
  })
})
