import type { Completion } from '@echostash/llm'
import type { DatasetCase, EvalJobSpec, Scorer, Variant } from '@echostash/shared'
import { describe, expect, it } from 'vitest'
import { type CompleteFn, runEval } from '../src/index'

const variant = (over: Partial<Variant> = {}): Variant => ({
  id: 'v1',
  promptId: 'p1',
  name: 'A',
  messages: [
    { role: 'system', content: 'You are a translator. Reply with ONLY the translation.' },
    { role: 'user', content: 'Translate to French: {{text}}' },
  ],
  provider: 'openai',
  model: 'gpt-4o-mini',
  params: {},
  source: 'sandbox',
  baseSnapshotId: null,
  ...over,
})

const caseOf = (id: string, text: string, expected: string): DatasetCase => ({
  id,
  datasetId: 'd1',
  name: id,
  input: { text },
  expected,
  source: 'manual',
  position: 0,
})

const containsScorer: Scorer = {
  id: 's-contains',
  name: 'contains bonjour',
  family: 'string',
  op: 'contains',
  config: { value: 'bonjour' },
  target: 'response',
  weight: 1,
  negate: false,
}

const spec = (over: Partial<EvalJobSpec> = {}): EvalJobSpec => ({
  runId: 'run1',
  variants: [variant()],
  cases: [caseOf('c1', 'hello', 'bonjour'), caseOf('c2', 'goodbye', 'au revoir')],
  scorers: [containsScorer],
  sampleCount: 1,
  allowedProviders: ['openai'],
  ...over,
})

/** A deterministic fake model: echoes a canned reply per input, with fixed usage. */
const fakeLLM =
  (replies: Record<string, string>): CompleteFn =>
  async ({ messages }) => {
    const userText = messages?.find((m) => m.role === 'user')?.content ?? ''
    const key = Object.keys(replies).find((k) => userText.includes(k)) ?? ''
    return {
      text: replies[key] ?? '',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      latencyMs: 1,
      finishReason: 'stop',
    } satisfies Completion
  }

describe('runEval', () => {
  it('runs the variant × case matrix and scores every cell', async () => {
    const res = await runEval(spec(), {
      complete: fakeLLM({ hello: 'bonjour', goodbye: 'au revoir' }),
    })

    expect(res.runId).toBe('run1')
    expect(res.cells).toHaveLength(2) // 1 variant × 2 cases × 1 sample
    expect(res.scores).toHaveLength(2) // × 1 scorer
    // interpolation reached the model + usage/cost were captured
    const c1 = res.cells.find((c) => c.caseId === 'c1')
    expect(c1?.outputText).toBe('bonjour')
    expect(c1?.totalTokens).toBe(15)
    expect(c1?.costUsd).toBeGreaterThan(0) // gpt-4o-mini is priced

    // c1 contains "bonjour" → pass; c2 ("au revoir") does not → fail
    const byCase = Object.fromEntries(res.scores.map((s) => [s.caseId, s.passed]))
    expect(byCase.c1).toBe(true)
    expect(byCase.c2).toBe(false)

    expect(res.summary).toMatchObject({ total: 2, passed: 1, failed: 1, errored: 0 })
    expect(res.summary?.score).toBeCloseTo(0.5)
  })

  it('honours sampleCount (variant × case × sample)', async () => {
    const res = await runEval(spec({ sampleCount: 3 }), {
      complete: fakeLLM({ hello: 'bonjour', goodbye: 'au revoir' }),
    })
    expect(res.cells).toHaveLength(6) // 1 × 2 × 3
    expect(res.scores).toHaveLength(6)
  })

  it('records an errored cell (not a throw) when the model call fails', async () => {
    const boom: CompleteFn = async () => {
      throw Object.assign(new Error('rate limited'), { statusCode: 429 })
    }
    const res = await runEval(spec(), { complete: boom, retries: 0 })
    expect(res.cells).toHaveLength(2)
    expect(res.cells.every((c) => c.outputText === '')).toBe(true)
    expect(res.summary).toMatchObject({ errored: 2, passed: 0, failed: 0 })
    expect(res.summary?.score).toBeNull()
  })

  it('skips variants whose provider is not allowed', async () => {
    const res = await runEval(
      spec({ variants: [variant({ provider: 'anthropic', model: 'claude-3-5-haiku' })] }),
      { complete: fakeLLM({ hello: 'bonjour' }), onWarn: () => {} },
    )
    expect(res.cells).toHaveLength(0)
  })
})
