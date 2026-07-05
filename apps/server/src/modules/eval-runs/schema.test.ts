import { describe, expect, it } from 'vitest'
import { CreateEvalRun } from './schema'
import { configHashOf } from './service'

describe('eval-runs', () => {
  it('requires at least one variant and one scorer', () => {
    const base = { promptId: 'p', datasetId: 'd', variantIds: ['v1'], scorerIds: ['s1'] }
    expect(CreateEvalRun.safeParse(base).success).toBe(true)
    expect(CreateEvalRun.safeParse({ ...base, variantIds: [] }).success).toBe(false)
    expect(CreateEvalRun.safeParse({ ...base, scorerIds: [] }).success).toBe(false)
  })

  it('defaults sampleCount to 1 and trigger to manual', () => {
    const r = CreateEvalRun.safeParse({
      promptId: 'p',
      datasetId: 'd',
      variantIds: ['v1'],
      scorerIds: ['s1'],
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.sampleCount).toBe(1)
      expect(r.data.trigger).toBe('manual')
    }
  })

  it('configHash is order-independent for variants/scorers', () => {
    const a = configHashOf({
      datasetId: 'd',
      variantIds: ['v1', 'v2'],
      scorerIds: ['s2', 's1'],
      sampleCount: 1,
    })
    const b = configHashOf({
      datasetId: 'd',
      variantIds: ['v2', 'v1'],
      scorerIds: ['s1', 's2'],
      sampleCount: 1,
    })
    expect(a).toBe(b)
  })

  it('configHash changes with sampleCount', () => {
    const a = configHashOf({
      datasetId: 'd',
      variantIds: ['v1'],
      scorerIds: ['s1'],
      sampleCount: 1,
    })
    const b = configHashOf({
      datasetId: 'd',
      variantIds: ['v1'],
      scorerIds: ['s1'],
      sampleCount: 3,
    })
    expect(a).not.toBe(b)
  })
})
