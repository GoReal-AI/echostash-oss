import { describe, expect, it } from 'vitest'
import { CiCheckRequest, CiCheckResponse } from '@echostash/shared'

describe('CI check regression schemas', () => {
  it('validates a well-formed CiCheckRequest and defaults threshold to 0', () => {
    const parsed = CiCheckRequest.parse({
      gitSha: 'abcdef1234567890',
      gitRef: 'refs/pull/42/merge',
      changedFingerprints: ['fp_prompt_1', 'fp_prompt_2'],
    })

    expect(parsed.threshold).toBe(0)
    expect(parsed.changedFingerprints).toHaveLength(2)
  })

  it('validates a passing and failing CiCheckResponse', () => {
    const passing = CiCheckResponse.parse({
      pass: true,
      threshold: 0.05,
      results: [
        {
          fingerprint: 'fp_prompt_1',
          score: 0.95,
          baseline: 0.96,
          delta: -0.01,
          regressed: false,
        },
      ],
    })
    expect(passing.pass).toBe(true)

    const failing = CiCheckResponse.parse({
      pass: false,
      threshold: 0.05,
      results: [
        {
          fingerprint: 'fp_prompt_2',
          score: 0.75,
          baseline: 0.95,
          delta: -0.2,
          regressed: true,
        },
      ],
    })
    expect(failing.pass).toBe(false)
    expect(failing.results[0].regressed).toBe(true)
  })
})
