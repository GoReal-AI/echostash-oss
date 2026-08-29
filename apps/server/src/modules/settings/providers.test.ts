import { describe, expect, it } from 'vitest'
import { ProviderConfig, SetProviderKeyRequest } from '@echostash/shared'
import { maskKey, KNOWN_PROVIDERS } from './providers'

describe('Provider config and schemas', () => {
  it('masks sensitive API keys properly', () => {
    expect(maskKey('mock-provider-key-1234567890abcdef')).toBe('mock••••cdef')
    expect(maskKey('short')).toBe('••••••••')
  })

  it('validates ProviderConfig schema', () => {
    const valid = ProviderConfig.parse({
      provider: 'openai',
      name: 'OpenAI',
      configured: true,
      keyMasked: 'sk-p••••1234',
    })
    expect(valid.provider).toBe('openai')
    expect(valid.configured).toBe(true)
  })

  it('validates SetProviderKeyRequest schema', () => {
    const valid = SetProviderKeyRequest.parse({
      apiKey: 'sk-test-key-12345',
    })
    expect(valid.apiKey).toBe('sk-test-key-12345')

    expect(() => SetProviderKeyRequest.parse({ apiKey: '' })).toThrow()
  })

  it('contains expected default providers in KNOWN_PROVIDERS list', () => {
    const ids = KNOWN_PROVIDERS.map((p) => p.id)
    expect(ids).toContain('openai')
    expect(ids).toContain('anthropic')
    expect(ids).toContain('google')
  })
})
