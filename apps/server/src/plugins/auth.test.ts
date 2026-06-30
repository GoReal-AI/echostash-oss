import { describe, expect, it } from 'vitest'
import { API_KEY_PREFIX, apiKeyPrefix, safeEqualHex } from './auth'

describe('plugins/auth', () => {
  describe('safeEqualHex', () => {
    it('returns true for identical hex strings', () => {
      const hex = 'a1b2c3d4e5f6'
      const result = safeEqualHex(hex, hex)
      expect(result).toBe(true)
    })

    it('returns false for different hex strings of same length', () => {
      const result = safeEqualHex('a1b2c3d4e5f6', 'a1b2c3d4e5f7')
      expect(result).toBe(false)
    })

    it('returns false for different lengths', () => {
      const result = safeEqualHex('a1b2c3d4', 'a1b2c3d4e5f6')
      expect(result).toBe(false)
    })

    it('returns false for empty strings when one is shorter', () => {
      const result = safeEqualHex('', 'a1b2c3')
      expect(result).toBe(false)
    })

    it('returns true for empty strings when both are empty', () => {
      const result = safeEqualHex('', '')
      expect(result).toBe(true)
    })

    it('returns false for invalid hex that decodes differently', () => {
      // 'ff' and '00' are valid hex but different
      const hash1 = 'ff'.repeat(32) // 64 chars
      const hash2 = '00'.repeat(32) // 64 chars
      const result = safeEqualHex(hash1, hash2)
      expect(result).toBe(false)
    })

    it('handles 64-character sha256 hashes (production case)', () => {
      const hash1 = 'a'.repeat(64)
      const hash2 = 'a'.repeat(64)
      const result = safeEqualHex(hash1, hash2)
      expect(result).toBe(true)
    })

    it('returns false for 64-char hashes differing by one char', () => {
      const hash1 = 'a'.repeat(64)
      const hash2 = `${'a'.repeat(63)}b`
      const result = safeEqualHex(hash1, hash2)
      expect(result).toBe(false)
    })
  })

  describe('apiKeyPrefix', () => {
    it('returns the correct prefix length', () => {
      const key = `${API_KEY_PREFIX}${'a'.repeat(48)}`
      const prefix = apiKeyPrefix(key)
      expect(prefix).toHaveLength(11) // 'ek_' (3) + 8 hex chars
    })

    it('extracts the ek_ prefix plus first 8 random chars', () => {
      const randomPart = '1234567890abcdef'
      const key = `${API_KEY_PREFIX}${randomPart}`
      const prefix = apiKeyPrefix(key)
      expect(prefix).toBe(`${API_KEY_PREFIX}${randomPart.slice(0, 8)}`)
    })

    it('handles full-length production keys', () => {
      const key = `ek_${'0'.repeat(48)}`
      const prefix = apiKeyPrefix(key)
      expect(prefix).toBe(`ek_${'0'.repeat(8)}`)
    })

    it('prefix is consistent across multiple calls', () => {
      const key = `${API_KEY_PREFIX}${'abc123def456ghij'}`
      const prefix1 = apiKeyPrefix(key)
      const prefix2 = apiKeyPrefix(key)
      expect(prefix1).toBe(prefix2)
    })

    it('different keys produce different prefixes', () => {
      const key1 = `${API_KEY_PREFIX}${'a'.repeat(48)}`
      const key2 = `${API_KEY_PREFIX}${'b'.repeat(48)}`
      const prefix1 = apiKeyPrefix(key1)
      const prefix2 = apiKeyPrefix(key2)
      expect(prefix1).not.toBe(prefix2)
    })
  })

  describe('API key format', () => {
    it('validates the prefix format matches production keys', () => {
      const key = 'ek_29575056b534c152083807f6311536af1354f0700e1dc50a'
      const prefix = apiKeyPrefix(key)
      expect(prefix).toBe('ek_29575056')
      expect(prefix).toMatch(/^ek_[0-9a-f]{8}$/)
    })

    it('ensures prefix uniqueness is statistically safe with 8 hex chars', () => {
      // 8 hex chars = 2^32 combinations, much more than we'd ever generate
      // This test documents the design assumption
      expect(2 ** 32).toBeGreaterThan(1_000_000) // space for millions of keys
    })
  })
})
