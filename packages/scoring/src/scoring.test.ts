import type { Scorer } from '@echostash/shared'
import { describe, expect, it } from 'vitest'
import { evaluate, parseJudgeVerdict } from './index'

function scorer(p: Partial<Scorer> & Pick<Scorer, 'family' | 'op'>): Scorer {
  return { id: 's', name: 's', config: {}, target: 'response', weight: 1, negate: false, ...p }
}

describe('string scorers', () => {
  it('contains', async () => {
    const r = await evaluate(
      scorer({ family: 'string', op: 'contains', config: { value: 'hi' } }),
      {
        output: 'well hi there',
      },
    )
    expect(r.status).toBe('pass')
  })
  it('matches regex', async () => {
    const r = await evaluate(
      scorer({ family: 'string', op: 'matches', config: { pattern: '^\\d{3}$' } }),
      { output: '123' },
    )
    expect(r.status).toBe('pass')
  })
  it('length range fails out of bounds', async () => {
    const r = await evaluate(
      scorer({ family: 'string', op: 'length', config: { min: 1, max: 3 } }),
      { output: 'too long' },
    )
    expect(r.status).toBe('fail')
  })
  it('negate inverts the verdict', async () => {
    const r = await evaluate(
      scorer({ family: 'string', op: 'contains', config: { value: 'secret' }, negate: true }),
      { output: 'this leaks a secret' },
    )
    expect(r.status).toBe('fail')
  })
})

describe('structural scorers', () => {
  it('json_valid', async () => {
    expect(
      (await evaluate(scorer({ family: 'structural', op: 'json_valid' }), { output: '{"a":1}' }))
        .status,
    ).toBe('pass')
    expect(
      (await evaluate(scorer({ family: 'structural', op: 'json_valid' }), { output: 'nope' }))
        .status,
    ).toBe('fail')
  })
  it('json_schema', async () => {
    const s = scorer({
      family: 'structural',
      op: 'json_schema',
      config: {
        schema: { type: 'object', required: ['a'], properties: { a: { type: 'number' } } },
      },
    })
    expect((await evaluate(s, { output: '{"a":1}' })).status).toBe('pass')
    expect((await evaluate(s, { output: '{"b":1}' })).status).toBe('fail')
  })
  it('yaml_valid', async () => {
    expect(
      (await evaluate(scorer({ family: 'structural', op: 'yaml_valid' }), { output: 'a: 1\nb: 2' }))
        .status,
    ).toBe('pass')
    expect(
      (
        await evaluate(scorer({ family: 'structural', op: 'yaml_valid' }), {
          output: 'a: "unterminated',
        })
      ).status,
    ).toBe('fail')
  })
})

describe('operational scorers', () => {
  it('latency under max passes', async () => {
    const r = await evaluate(
      scorer({ family: 'operational', op: 'latency', config: { max: 1000 } }),
      {
        output: 'x',
        metrics: { latencyMs: 420 },
      },
    )
    expect(r.status).toBe('pass')
  })
})

describe('llm_judge', () => {
  it('parses a fenced verdict', () => {
    const out = parseJudgeVerdict('```json\n{"score":0.9,"reason":"good"}\n```')
    expect(out.score).toBeCloseTo(0.9)
  })
  it('passes when judge score >= threshold', async () => {
    const judge = async () => '{"score": 0.8, "reason": "calm and short"}'
    const r = await evaluate(
      scorer({ family: 'llm_judge', op: 'judge', config: { rubric: 'is it calm?' } }),
      { output: 'sure, happy to help' },
      { judge },
    )
    expect(r.status).toBe('pass')
    expect(r.score).toBeCloseTo(0.8)
  })
  it('errors without a judge fn', async () => {
    const r = await evaluate(
      scorer({ family: 'llm_judge', op: 'judge', config: { rubric: 'x' } }),
      { output: 'y' },
    )
    expect(r.status).toBe('error')
  })
})
