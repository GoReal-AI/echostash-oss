import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { scan } from '../src/index'

const root = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'sample-app')

describe('scan', () => {
  it('detects an OpenAI chat.completions.create call site', async () => {
    const prompts = await scan({ root })
    const p = prompts.find((x) => x.fingerprint === 'openai-chat.ts:summarize')
    expect(p).toBeDefined()
    expect(p?.provider).toBe('openai')
    expect(p?.model).toBe('gpt-4o')
    expect(p?.params).toEqual({ temperature: 0.2, maxTokens: 500 })
    expect(p?.resolution).toBe('resolved')
    expect(p?.messages).toEqual([
      { role: 'system', content: 'You are a terse summarizer.' },
      { role: 'user', content: 'Summarize the following text.' },
    ])
    expect(p?.symbol).toBe('summarize')
    expect(p?.line).toBeGreaterThan(0)
  })

  it('detects a Vercel AI SDK generateText call, resolving a const and a template', async () => {
    const prompts = await scan({ root })
    const p = prompts.find((x) => x.fingerprint === 'vercel.ts:reply')
    expect(p).toBeDefined()
    expect(p?.provider).toBe('openai')
    expect(p?.model).toBe('gpt-4o-mini')
    expect(p?.params).toEqual({ temperature: 0.7 })
    // system resolved via the SYSTEM const; prompt is a template -> partial w/ a hole
    expect(p?.resolution).toBe('partial')
    expect(p?.messages).toEqual([
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Greet {{name}} warmly.' },
    ])
  })

  it('finds exactly the two known call sites', async () => {
    const prompts = await scan({ root })
    expect(prompts).toHaveLength(2)
  })
})
