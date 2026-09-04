import { describe, expect, it } from 'vitest'
import { costUsd, isPriced } from '../src/cost'

describe('costUsd', () => {
  it('prices a known model from token usage', () => {
    // gpt-4o-mini: $0.15/1M in, $0.60/1M out → 1000 in + 500 out
    const c = costUsd('gpt-4o-mini', {
      promptTokens: 1000,
      completionTokens: 500,
      totalTokens: 1500,
    })
    expect(c).toBeCloseTo((1000 / 1e6) * 0.15 + (500 / 1e6) * 0.6, 10)
  })

  it('prices Claude 3.7 and Claude 4.5 families', () => {
    expect(isPriced('claude-3-7-sonnet-20250219')).toBe(true)
    expect(isPriced('claude-4.5-sonnet')).toBe(true)
    const cost = costUsd('claude-3-7-sonnet', {
      promptTokens: 1e6,
      completionTokens: 1e6,
      totalTokens: 2e6,
    })
    expect(cost).toBeCloseTo(3.0 + 15.0)
  })

  it('prices reasoning models (o1, o3, deepseek-r1)', () => {
    expect(isPriced('o1')).toBe(true)
    expect(isPriced('o3-mini')).toBe(true)
    expect(isPriced('deepseek-r1')).toBe(true)
    expect(isPriced('deepseek-reasoner')).toBe(true)

    const r1Cost = costUsd('deepseek-r1', {
      promptTokens: 1e6,
      completionTokens: 1e6,
      totalTokens: 2e6,
    })
    expect(r1Cost).toBeCloseTo(0.55 + 2.19)
  })

  it('longest-prefix matches a dated model id', () => {
    expect(isPriced('gpt-4o-2024-08-06')).toBe(true)
    expect(
      costUsd('gpt-4o-2024-08-06', { promptTokens: 1e6, completionTokens: 0, totalTokens: 1e6 }),
    ).toBeCloseTo(2.5)
  })

  it('returns null for an unpriced model', () => {
    expect(isPriced('some-local-llama')).toBe(false)
    expect(
      costUsd('some-local-llama', { promptTokens: 100, completionTokens: 100, totalTokens: 200 }),
    ).toBeNull()
  })
})
