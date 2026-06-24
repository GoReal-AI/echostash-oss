import { describe, it, expect } from 'vitest'
import { verifyPassword } from './service'

describe('auth/service', () => {
  describe('verifyPassword', () => {
    it('returns true for correct password', () => {
      const password = 'correct-password-123'
      const result = verifyPassword(password, password)
      expect(result).toBe(true)
    })

    it('returns false for incorrect password', () => {
      const result = verifyPassword('wrong-password', 'correct-password')
      expect(result).toBe(false)
    })

    it('returns false for empty strings with different values', () => {
      const result = verifyPassword('', 'not-empty')
      expect(result).toBe(false)
    })

    it('returns true for matching empty strings', () => {
      const result = verifyPassword('', '')
      expect(result).toBe(true)
    })

    it('returns false for case-sensitive mismatch', () => {
      const result = verifyPassword('Password', 'password')
      expect(result).toBe(false)
    })

    it('handles long passwords correctly', () => {
      const longPassword = 'a'.repeat(1000)
      const result = verifyPassword(longPassword, longPassword)
      expect(result).toBe(true)
    })

    it('handles special characters in passwords', () => {
      const specialPassword = '!@#$%^&*()_+-=[]{}|;:,.<>?'
      const result = verifyPassword(specialPassword, specialPassword)
      expect(result).toBe(true)
    })
  })
})
