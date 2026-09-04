import { describe, expect, it } from 'vitest'
import { evaluateToolSelection, renderEvalReport } from '../src/eval'
import type { McpCase, McpToolSurface } from '@echostash/shared'

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
      name: 'cancel_subscription',
      title: 'Cancel Subscription',
      description: 'Cancel a subscription',
      inputSchema: {},
    },
  ],
}

const mockCases: McpCase[] = [
  {
    id: 'c1',
    query: 'refund my order',
    expectTool: 'refund_order',
    source: 'manual',
  },
  {
    id: 'c2',
    query: 'cancel my plan',
    expectTool: 'cancel_subscription',
    source: 'manual',
  },
  {
    id: 'c3',
    query: 'what is the weather today?',
    expectTool: null,
    source: 'generated',
  },
]

describe('evaluateToolSelection', () => {
  it('correctly scores perfect selection and constructs confusion matrix', async () => {
    const decideFn = async (query: string) => {
      if (query.includes('refund')) return { toolName: 'refund_order' }
      if (query.includes('cancel')) return { toolName: 'cancel_subscription' }
      return { toolName: null }
    }

    const report = await evaluateToolSelection(mockSurface, mockCases, decideFn)

    expect(report.totalCases).toBe(3)
    expect(report.overallAccuracy).toBe(1.0)
    expect(report.manualAccuracy).toBe(1.0)
    expect(report.generatedAccuracy).toBe(1.0)

    expect(report.confusionMatrix.matrix['refund_order']?.['refund_order']).toBe(1)
    expect(report.confusionMatrix.matrix['cancel_subscription']?.['cancel_subscription']).toBe(1)
    expect(report.confusionMatrix.matrix['(none)']?.['(none)']).toBe(1)
  })

  it('captures misrouting in confusion matrix and separates accuracy by source', async () => {
    // Model erroneously routes 'cancel my plan' to 'refund_order' (stealing traffic)
    const decideFn = async (query: string) => {
      if (query.includes('refund')) return { toolName: 'refund_order' }
      if (query.includes('cancel')) return { toolName: 'refund_order' }
      return { toolName: null }
    }

    const report = await evaluateToolSelection(mockSurface, mockCases, decideFn)

    expect(report.overallAccuracy).toBeCloseTo(2 / 3)
    expect(report.manualAccuracy).toBe(0.5) // 1 of 2 manual correct
    expect(report.generatedAccuracy).toBe(1.0) // 1 of 1 generated correct

    // Expected cancel_subscription, but Actual was refund_order
    expect(report.confusionMatrix.matrix['cancel_subscription']?.['refund_order']).toBe(1)
    expect(report.confusionMatrix.matrix['cancel_subscription']?.['cancel_subscription']).toBe(0)

    const text = renderEvalReport(report)
    expect(text).toContain('MCP Tool Selection Evaluation — acme-server')
    expect(text).toContain('Confusion Matrix')
  })
})
