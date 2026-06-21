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
