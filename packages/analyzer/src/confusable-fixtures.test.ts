import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { McpToolSurface } from '@echostash/shared'
import { describe, expect, it } from 'vitest'
import { confusablePairs } from './index'

// Anonymized confusable-pair fixtures contributed in #136 (see #93). Each set is a recorded
// tool surface plus the pairs a selector is known to confuse in practice:
//   A: near-duplicate verbs on the same object     (get_user / fetch_user)
//   B: overlapping descriptions, different effects  (send_email / draft_email)
//   C: always-on shortlist vs deferred sibling      (calendar_create_event / _recurring_event)
// The check must flag every expected pair and nothing else: the distractors in each set are
// there to catch a threshold that drifts too low.
const FIXTURES = join(__dirname, '..', 'test', 'fixtures', 'confusable')

const key = (a: string, b: string) => [a, b].sort().join(' <> ')

describe.each(['a', 'b', 'c'])('confusable fixture set %s', (set) => {
  const surface = McpToolSurface.parse(
    JSON.parse(readFileSync(join(FIXTURES, `${set}.json`), 'utf8')),
  )
  const expected = JSON.parse(readFileSync(join(FIXTURES, `${set}.expected.json`), 'utf8')) as {
    a: string
    b: string
    reason: string
  }[]

  it('flags exactly the expected pairs', () => {
    const flagged = confusablePairs(surface).map((p) => key(p.a, p.b))
    const wanted = expected.map((p) => key(p.a, p.b))
    expect(new Set(flagged)).toEqual(new Set(wanted))
  })

  it('leaves the distractors unpaired', () => {
    const inPairs = new Set(expected.flatMap((p) => [p.a, p.b]))
    const distractors = surface.tools.map((t) => t.name).filter((n) => !inPairs.has(n))
    expect(distractors.length).toBeGreaterThan(0)
    const flaggedNames = new Set(confusablePairs(surface).flatMap((p) => [p.a, p.b]))
    for (const d of distractors)
      expect(flaggedNames.has(d), `${d} should not be confusable`).toBe(false)
  })
})
