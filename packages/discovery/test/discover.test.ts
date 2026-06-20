import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { discoverPrompts } from '../src/index'

const root = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/sample')
const prompts = discoverPrompts(root)
const byFingerprint = new Map(prompts.map((p) => [p.fingerprint, p]))

describe('discoverPrompts (usage-anchored, deterministic — no model)', () => {
  it('reads an inline OpenAI call: model, provider, and the system message', () => {
    const p = byFingerprint.get('src/openai-chat.ts:summarize')
    expect(p).toBeDefined()
    expect(p?.provider).toBe('openai')
    expect(p?.model).toBe('gpt-4o-mini')
    expect(p?.params).toMatchObject({ temperature: 0.2 })
    expect(
      p?.messages.some((m) => m.role === 'system' && /concise summarizer/.test(m.content)),
    ).toBe(true)
  })

  it('resolves a structural systemPrompt back to its const definition (framework-agnostic)', () => {
    const p = byFingerprint.get('src/agent.ts:SYSTEM_PROMPT')
    expect(p?.messages[0]?.content).toMatch(/You are Sample Agent/)
  })

  it('resolves a traced const through a Python structural key', () => {
    const p = byFingerprint.get('src/service.py:SYSTEM')
    expect(p?.messages[0]?.content).toMatch(/helpful assistant/)
  })

  it('captures a dedicated prompt file whole (fallback)', () => {
    const p = byFingerprint.get('prompts/reviewer.st:reviewer.st')
    expect(p?.messages[0]?.content).toMatch(/code reviewer/)
  })

  it('detects task instructions with no "you are" via multiple instructional cues', () => {
    const p = byFingerprint.get('src/instructions.ts:REVIEW_GUIDE')
    expect(p?.messages[0]?.content).toMatch(/Make sure to read the diff/)
  })

  it('does not flag comments, tool-schema descriptions, SQL, or a lone-"please" log string', () => {
    expect(prompts.some((p) => p.filePath.includes('noise'))).toBe(false)
  })

  it('finds exactly the five real prompts and nothing else', () => {
    expect(prompts).toHaveLength(5)
  })
})
