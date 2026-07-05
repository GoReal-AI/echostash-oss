import { describe, expect, it } from 'vitest'
import { CreateScorer, isValidScorer } from './schema'

describe('scorers/schema', () => {
  it('accepts a valid family+op with defaults applied', () => {
    const r = CreateScorer.safeParse({
      name: 'has-hello',
      family: 'string',
      op: 'contains',
      config: { value: 'hi' },
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.weight).toBe(1)
      expect(r.data.negate).toBe(false)
    }
  })

  it('rejects an op that does not belong to the family', () => {
    const r = CreateScorer.safeParse({ name: 'bad', family: 'string', op: 'json_valid' })
    expect(r.success).toBe(false)
  })

  it('rejects an unknown family', () => {
    const r = CreateScorer.safeParse({ name: 'bad', family: 'telepathy', op: 'contains' })
    expect(r.success).toBe(false)
  })

  it('rejects a threshold outside 0..1', () => {
    const r = CreateScorer.safeParse({
      name: 'j',
      family: 'llm_judge',
      op: 'judge',
      threshold: 1.5,
    })
    expect(r.success).toBe(false)
  })

  it('isValidScorer matches the catalog', () => {
    expect(isValidScorer('string', 'contains')).toBe(true)
    expect(isValidScorer('structural', 'json_valid')).toBe(true)
    expect(isValidScorer('string', 'json_valid')).toBe(false)
  })
})
