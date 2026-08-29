import type { Scorer } from '@echostash/shared'
import { describe, expect, it } from 'vitest'
import { evaluate, parseJudgeVerdict, SCORER_CATALOG } from './index'

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

describe('tool_selection scorers', () => {
  it('passes when tool choice matches config.tool', async () => {
    const r = await evaluate(
      scorer({
        family: 'tool_selection',
        op: 'selected_tool',
        target: 'tool_choice',
        config: { tool: 'calculator' },
      }),
      {
        output: '',
        toolChoice: { name: 'calculator' },
      },
    )
    expect(r.status).toBe('pass')
    expect(r.score).toBe(1)
  })

  it('passes when tool choice matches ctx.expected fallback', async () => {
    const r = await evaluate(
      scorer({
        family: 'tool_selection',
        op: 'selected_tool',
        target: 'tool_choice',
      }),
      {
        output: '',
        expected: 'search',
        toolChoice: { name: 'search' },
      },
    )
    expect(r.status).toBe('pass')
  })

  it('fails when tool choice does not match', async () => {
    const r = await evaluate(
      scorer({
        family: 'tool_selection',
        op: 'selected_tool',
        target: 'tool_choice',
        config: { tool: 'calculator' },
      }),
      {
        output: '',
        toolChoice: { name: 'search' },
      },
    )
    expect(r.status).toBe('fail')
    expect(r.score).toBe(0)
    expect(r.reason).toContain('expected tool "calculator", got "search"')
  })

  it('fails when expected tool is missing', async () => {
    const r = await evaluate(
      scorer({
        family: 'tool_selection',
        op: 'selected_tool',
        target: 'tool_choice',
      }),
      {
        output: '',
        toolChoice: { name: 'search' },
      },
    )
    expect(r.status).toBe('fail')
    expect(r.reason).toContain('no expected tool specified')
  })
})

describe('SCORER_CATALOG integrity', () => {
  it('contains all implemented families and ops', () => {
    const families = SCORER_CATALOG.map((f) => f.family)
    expect(families).toContain('string')
    expect(families).toContain('structural')
    expect(families).toContain('operational')
    expect(families).toContain('llm_judge')
    expect(families).toContain('tool_selection')

    const toolSelection = SCORER_CATALOG.find((f) => f.family === 'tool_selection')
    expect(toolSelection).toBeDefined()
    expect(toolSelection?.deterministic).toBe(true)
    expect(toolSelection?.ops.map((o) => o.op)).toContain('selected_tool')
  })
})
