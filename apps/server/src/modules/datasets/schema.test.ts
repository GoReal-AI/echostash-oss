import { describe, expect, it } from 'vitest'
import { CreateCase, CreateDataset, slugify } from './schema'

describe('datasets/schema', () => {
  it('slugifies a display name', () => {
    expect(slugify('Support Bot Cases!')).toBe('support-bot-cases')
    expect(slugify('  A/B — test  ')).toBe('a-b-test')
    expect(slugify('!!!')).toBe('dataset')
  })

  it('requires a dataset name', () => {
    expect(CreateDataset.safeParse({}).success).toBe(false)
    expect(CreateDataset.safeParse({ name: 'Cases' }).success).toBe(true)
  })

  it('defaults case input to an empty object and source to manual', () => {
    const r = CreateCase.safeParse({ name: 'c1' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.input).toEqual({})
      expect(r.data.source).toBe('manual')
    }
  })

  it('accepts mocked prior messages on a case', () => {
    const r = CreateCase.safeParse({
      name: 'c1',
      input: { text: 'hi' },
      messages: [{ role: 'user', content: 'earlier turn' }],
      expected: 'bonjour',
    })
    expect(r.success).toBe(true)
  })
})
