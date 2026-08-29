import { describe, expect, it } from 'vitest'
import { z } from 'zod'

const ScanRunsQuery = z.object({
  sourceId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
})

const ChangeFeedQuery = z.object({
  sourceId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
})

describe('scan-runs and change-feed query schema validation', () => {
  it('parses empty query params with default limits', () => {
    const scanRuns = ScanRunsQuery.parse({})
    expect(scanRuns.limit).toBe(20)
    expect(scanRuns.sourceId).toBeUndefined()

    const changeFeed = ChangeFeedQuery.parse({})
    expect(changeFeed.limit).toBe(50)
    expect(changeFeed.sourceId).toBeUndefined()
  })

  it('parses valid sourceId and custom limit', () => {
    const parsed = ScanRunsQuery.parse({ sourceId: 'src_123', limit: '10' })
    expect(parsed.sourceId).toBe('src_123')
    expect(parsed.limit).toBe(10)
  })

  it('rejects invalid limit values', () => {
    expect(() => ScanRunsQuery.parse({ limit: 0 })).toThrow()
    expect(() => ScanRunsQuery.parse({ limit: 500 })).toThrow()
  })
})
