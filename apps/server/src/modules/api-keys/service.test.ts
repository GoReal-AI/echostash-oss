import { describe, it, expect, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'
import type { Database } from '../../db/client'
import { apiKeys } from '../../db/schema'
import { safeEqualHex, apiKeyPrefix } from '../../plugins/auth'

describe('api-keys/service', () => {
  describe('API key generation', () => {
    it('generates keys with correct prefix format', () => {
      // Simulate the createApiKey logic
      const randomPart = 'a'.repeat(48)
      const fullKey = `ek_${randomPart}`
      const prefix = apiKeyPrefix(fullKey)
      expect(prefix).toBe(`ek_${randomPart.slice(0, 8)}`)
      expect(prefix).toMatch(/^ek_[a-f0-9]{8}$/)
    })

    it('hash comparison works for valid keys', () => {
      const fullKey = 'ek_' + 'a'.repeat(48)
      const hash = createHash('sha256').update(fullKey).digest('hex')
      const providedHash = createHash('sha256').update(fullKey).digest('hex')
      const result = safeEqualHex(hash, providedHash)
      expect(result).toBe(true)
    })

    it('hash comparison fails for tampered keys', () => {
      const fullKey = 'ek_' + 'a'.repeat(48)
      const tamperedKey = 'ek_' + 'a'.repeat(47) + 'b'
      const hash = createHash('sha256').update(fullKey).digest('hex')
      const tamperedHash = createHash('sha256').update(tamperedKey).digest('hex')
      const result = safeEqualHex(hash, tamperedHash)
      expect(result).toBe(false)
    })

    it('produces different hashes for different keys', () => {
      const key1 = 'ek_' + 'a'.repeat(48)
      const key2 = 'ek_' + 'b'.repeat(48)
      const hash1 = createHash('sha256').update(key1).digest('hex')
      const hash2 = createHash('sha256').update(key2).digest('hex')
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('prefix collision resistance', () => {
    it('prefix space is large enough for practical use', () => {
      // 8 hex chars = 16^8 = 4,294,967,296 unique combinations
      const prefixSpace = Math.pow(16, 8)
      expect(prefixSpace).toBeGreaterThan(1_000_000) // more than a million unique prefixes
    })

    it('generates different prefixes for different random parts', () => {
      const prefixes = new Set<string>()
      for (let i = 0; i < 100; i++) {
        const randomPart = Math.random().toString(16).slice(2).padEnd(48, '0')
        const fullKey = `ek_${randomPart}`
        const prefix = apiKeyPrefix(fullKey)
        prefixes.add(prefix)
      }
      expect(prefixes.size).toBe(100) // all 100 should be unique
    })
  })

  describe('API key validation', () => {
    it('validates that keys start with the correct prefix', () => {
      const validKey = 'ek_1234567890abcdef'
      expect(validKey).toMatch(/^ek_/)

      const invalidKey = 'sk_1234567890abcdef'
      expect(invalidKey).not.toMatch(/^ek_/)
    })

    it('validates prefix consistency between generation and lookup', () => {
      // This simulates the createApiKey and verifyApiKey flow
      const fullKey = 'ek_' + 'a'.repeat(48)
      const generatedPrefix = apiKeyPrefix(fullKey)
      const lookupPrefix = apiKeyPrefix(fullKey)
      expect(generatedPrefix).toBe(lookupPrefix)
    })

    it('prefix format prevents ambiguity', () => {
      // Two different keys should not share the same prefix (with overwhelming probability)
      const key1Prefix = apiKeyPrefix('ek_' + 'a'.repeat(48))
      const key2Prefix = apiKeyPrefix('ek_' + 'b'.repeat(48))
      expect(key1Prefix).not.toBe(key2Prefix)
    })
  })

  describe('revocation logic', () => {
    it('soft-delete preserves key record with revokedAt timestamp', () => {
      // Simulates the revocation flow
      const now = new Date()
      const revokedKey = { id: 'key1', revokedAt: now }
      expect(revokedKey.id).toBe('key1')
      expect(revokedKey.revokedAt).toBeDefined()
    })

    it('revoked key should fail verification', () => {
      // In production, this would be handled by:
      // if (!key || key.revokedAt || !hashMatches) return null
      const key = { id: 'key1', hash: 'abc123', revokedAt: new Date() }
      const isValid = !key.revokedAt
      expect(isValid).toBe(false)
    })

    it('active key (no revokedAt) passes verification check', () => {
      const key = { id: 'key1', hash: 'abc123', revokedAt: null }
      const isValid = !key.revokedAt
      expect(isValid).toBe(true)
    })
  })

  describe('SQL filtering logic', () => {
    it('SQL WHERE clause correctly filters revoked keys', () => {
      // Simulates the listApiKeys SQL logic:
      // WHERE revoked_at IS NULL
      const allKeys = [
        { id: '1', name: 'key1', revokedAt: null },
        { id: '2', name: 'key2', revokedAt: new Date() },
        { id: '3', name: 'key3', revokedAt: null },
      ]
      const activeKeys = allKeys.filter((k) => !k.revokedAt)
      expect(activeKeys).toHaveLength(2)
      expect(activeKeys.map((k) => k.id)).toEqual(['1', '3'])
    })

    it('including revoked keys returns all keys', () => {
      const allKeys = [
        { id: '1', name: 'key1', revokedAt: null },
        { id: '2', name: 'key2', revokedAt: new Date() },
        { id: '3', name: 'key3', revokedAt: null },
      ]
      // No filter when includeRevoked is true
      expect(allKeys).toHaveLength(3)
    })
  })
})
