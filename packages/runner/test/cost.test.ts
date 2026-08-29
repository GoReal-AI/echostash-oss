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

  it('prices current generation models (claude-3-7-sonnet, gpt-5, deepseek-reasoner)', () => {
    expect(isPriced('claude-3-7-sonnet-20250219')).toBe(true)
    expect(
      costUsd('claude-3-7-sonnet-20250219', {
        promptTokens: 1e6,
        completionTokens: 1e6,
        totalTokens: 2e6,
      }),
    ).toBeCloseTo(3 + 15)

    expect(isPriced('gpt-5')).toBe(true)
    expect(
      costUsd('gpt-5', { promptTokens: 1e6, completionTokens: 1e6, totalTokens: 2e6 }),
    ).toBeCloseTo(5 + 20)

    expect(isPriced('deepseek-reasoner')).toBe(true)
    expect(
      costUsd('deepseek-reasoner', { promptTokens: 1e6, completionTokens: 1e6, totalTokens: 2e6 }),
    ).toBeCloseTo(0.55 + 2.19)
  })
})
