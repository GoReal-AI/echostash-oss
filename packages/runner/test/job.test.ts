import type { Completion } from '@echostash/llm'
import type { EvalJobSpec, EvalResult, EvalStatus } from '@echostash/shared'
import { describe, expect, it, vi } from 'vitest'
import type { CompleteFn } from '../src/index'
import { processEvalJob } from '../src/job'

const SPEC: EvalJobSpec = {
  runId: 'run1',
  variants: [
    {
      id: 'v1',
      promptId: 'p1',
      name: 'A',
      messages: [{ role: 'user', content: 'Echo: {{text}}' }],
      provider: 'openai',
      model: 'gpt-4o-mini',
      params: {},
      source: 'sandbox',
      baseSnapshotId: null,
    },
  ],
  cases: [
    {
      id: 'c1',
      datasetId: 'd1',
      name: 'hit',
      input: { text: 'fox' },
      expected: 'fox',
      source: 'manual',
      position: 0,
    },
  ],
  scorers: [
    {
      id: 's1',
      name: 'has-fox',
      family: 'string',
      op: 'contains',
      config: { value: 'fox' },
      target: 'response',
      weight: 1,
      negate: false,
    },
  ],
  sampleCount: 1,
  allowedProviders: ['openai'],
}

const fakeLLM: CompleteFn = async ({ messages }) => {
  const user = messages?.find((m) => m.role === 'user')?.content ?? ''
  return {
    text: user.replace(/^Echo:\s*/, ''),
    usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 },
    latencyMs: 1,
    finishReason: 'stop',
  } satisfies Completion
}

function fakeClient(overrides: Partial<Record<'getSpec', () => Promise<EvalJobSpec>>> = {}) {
  const statuses: Array<{ status: EvalStatus; error?: string }> = []
  let posted: EvalResult | null = null
  return {
    statuses,
    get posted() {
      return posted
    },
    client: {
      getSpec: overrides.getSpec ?? (async () => SPEC),
      postResults: async (_id: string, r: EvalResult) => {
        posted = r
      },
      postStatus: async (_id: string, status: EvalStatus, error?: string) => {
        statuses.push({ status, error })
      },
    },
  }
}

describe('processEvalJob', () => {
  it('marks running, runs the matrix, and posts results', async () => {
    const f = fakeClient()
    const result = await processEvalJob({ client: f.client, complete: fakeLLM }, 'run1')

    expect(f.statuses[0]?.status).toBe('running')
    expect(f.posted).not.toBeNull()
    expect(result.summary).toMatchObject({ total: 1, passed: 1, failed: 0 })
    expect(f.posted?.cells[0]?.outputText).toBe('fox')
  })

  it('reports error status and rethrows when the spec fetch fails', async () => {
    const f = fakeClient({
      getSpec: async () => {
        throw new Error('spec 404')
      },
    })
    await expect(processEvalJob({ client: f.client, complete: fakeLLM }, 'run1')).rejects.toThrow(
      'spec 404',
    )
    expect(f.statuses.map((s) => s.status)).toEqual(['running', 'error'])
    expect(f.statuses[1]?.error).toContain('spec 404')
    expect(f.posted).toBeNull()
  })
})
