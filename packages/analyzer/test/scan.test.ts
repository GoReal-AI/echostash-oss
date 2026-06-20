import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { type ClassifyItem, scan, scanReport } from '../src/index'

const root = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'sample-app')

describe('deterministic scan (no classifier)', () => {
  it('finds call-site prompts and definite-named prompt consts', async () => {
    const prompts = await scan({ root })
    const fps = prompts.map((p) => p.fingerprint)
    // call sites (OpenAI + Vercel)
    expect(fps).toContain('openai-chat.ts:summarize')
    expect(fps).toContain('vercel.ts:reply')
    // a `const SYSTEM = "You are…"` is a definite candidate (prompt-named) — no LLM needed
    expect(fps).toContain('vercel.ts:SYSTEM')
    // the gray-zone `helper` is NOT included without a classifier
    expect(fps).not.toContain('support.ts:helper')
  })

  it('reports libraries and gray-zone candidate counts', async () => {
    const report = await scanReport({ root })
    expect(Array.isArray(report.libraries)).toBe(true) // [] for this fixture (no package.json)
    expect(report.stats.candidates).toBeGreaterThanOrEqual(1) // `helper` is a gray candidate
  })
})

describe('classifier adjudicates only the gray zone', () => {
  it('the model sees only candidate-tier items, never definite/call-site ones', async () => {
    const seen: ClassifyItem[] = []
    const classifier = async (items: ClassifyItem[]) => {
      seen.push(...items)
      return items.map((i) => ({ id: i.id, isPrompt: i.name === 'helper' }))
    }
    const prompts = await scan({ root, classifier })
    const fps = prompts.map((p) => p.fingerprint)
    expect(fps).toContain('support.ts:helper') // accepted by the classifier
    // the classifier only ever saw gray-zone candidates (helper, sqlQuery) — not SYSTEM/summarize
    const names = seen.map((s) => s.name)
    expect(names).toContain('helper')
    expect(names).not.toContain('SYSTEM')
    expect(names).not.toContain('summarize')
  })

  it('classifier rejects non-prompts (sqlQuery stays out)', async () => {
    const classifier = async (items: ClassifyItem[]) =>
      items.map((i) => ({ id: i.id, isPrompt: i.name === 'helper' }))
    const prompts = await scan({ root, classifier })
    expect(prompts.map((p) => p.fingerprint)).not.toContain('support.ts:sqlQuery')
  })
})
