import { describe, expect, it } from 'vitest'
import { EvalJobSpec, EvalResult } from './eval'
import { ScanReport } from './scan'

describe('eval protocol', () => {
  it('parses a minimal job spec', () => {
    const spec = EvalJobSpec.parse({
      runId: 'run_1',
      variants: [
        {
          id: 'var_1',
          promptId: 'p_1',
          name: 'baseline',
          messages: [{ role: 'user', content: 'hi' }],
          provider: 'openai',
          model: 'gpt-4o',
          source: 'snapshot',
          baseSnapshotId: null,
        },
      ],
      cases: [{ id: 'c_1', datasetId: 'd_1', name: 'case 1', expected: null }],
      scorers: [{ id: 's_1', name: 'contains hi', family: 'string', op: 'contains' }],
      allowedProviders: ['openai'],
    })
    expect(spec.sampleCount).toBe(1)
    expect(spec.variants[0]?.params).toEqual({})
    expect(spec.scorers[0]?.weight).toBe(1)
    expect(spec.scorers[0]?.target).toBe('response')
  })

  it('parses a result payload', () => {
    const result = EvalResult.parse({
      runId: 'run_1',
      cells: [
        {
          variantId: 'var_1',
          caseId: 'c_1',
          sampleNo: 0,
          outputText: 'hello',
          promptTokens: 10,
          completionTokens: 2,
          totalTokens: 12,
          costUsd: 0.0001,
          latencyMs: 420,
        },
      ],
      scores: [
        { variantId: 'var_1', caseId: 'c_1', sampleNo: 0, scorerId: 's_1', value: 1, passed: true },
      ],
    })
    expect(result.cells).toHaveLength(1)
    expect(result.scores[0]?.passed).toBe(true)
  })
})

describe('scan report', () => {
  it('defaults empty content/messages', () => {
    const report = ScanReport.parse({
      context: { sourceName: 'local', gitSha: null, gitRef: null },
      prompts: [
        {
          fingerprint: 'chat.ts:summarize',
          name: 'summarize',
          provider: 'openai',
          model: 'gpt-4o',
          resolution: 'resolved',
          filePath: 'src/chat.ts',
          symbol: 'summarize',
          line: 12,
        },
      ],
    })
    expect(report.prompts[0]?.messages).toEqual([])
    expect(report.prompts[0]?.params).toEqual({})
  })
})
