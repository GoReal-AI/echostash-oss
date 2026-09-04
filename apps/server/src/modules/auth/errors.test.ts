import { describe, expect, it } from 'vitest'
import { AuthErrorCode, authError, validationDetails } from './errors'

describe('auth/errors', () => {
  describe('authError', () => {
    it('returns structured error with code and message', () => {
      const error = authError(AuthErrorCode.InvalidPassword)
      expect(error).toEqual({
        code: AuthErrorCode.InvalidPassword,
        message: 'Invalid password',
      })
    })

    it('includes details when provided', () => {
      const details = { field: 'password', reason: 'too short' }
      const error = authError(AuthErrorCode.InvalidRequest, details)
      expect(error.code).toBe(AuthErrorCode.InvalidRequest)
      expect(error.message).toBeDefined()
      expect(error.details).toBeDefined()
      expect(error.details).toEqual(details)
    })

    it('omits details key when not provided', () => {
      const error = authError(AuthErrorCode.Unauthorized)
      expect(error).not.toHaveProperty('details')
    })

    it('has distinct messages for each error code', () => {
      const messages = new Set([
        authError(AuthErrorCode.InvalidRequest).message,
        authError(AuthErrorCode.InvalidPassword).message,
        authError(AuthErrorCode.Unauthorized).message,
        authError(AuthErrorCode.Forbidden).message,
        authError(AuthErrorCode.TooManyAttempts).message,
        authError(AuthErrorCode.KeyNotFound).message,
        authError(AuthErrorCode.KeyCreationFailed).message,
        authError(AuthErrorCode.InternalError).message,
      ])
      expect(messages.size).toBe(8) // all unique
    })
  })

  describe('validationDetails', () => {
    it('formats zod issues into human-readable field paths', () => {
      const issues = [
        { path: ['password'], message: 'Required' },
        { path: ['name', '0'] as (string | number)[], message: 'Invalid input' },
      ]
      const result = validationDetails(issues)
      expect(result.fields).toEqual([
        { path: 'password', message: 'Required' },
        { path: 'name.0', message: 'Invalid input' },
      ])
    })

    it('handles numeric indices in paths', () => {
      const issues = [
        { path: ['items', 0, 'id'] as (string | number)[], message: 'Invalid ID' },
        { path: ['items', 1, 'name'] as (string | number)[], message: 'Name too long' },
      ]
      const result = validationDetails(issues)
      expect(result.fields).toHaveLength(2)
      expect(result.fields[0]?.path).toBe('items.0.id')
      expect(result.fields[1]?.path).toBe('items.1.name')
    })

    it('handles empty path arrays gracefully', () => {
      const issues = [{ path: [] as (string | number)[], message: 'General error' }]
      const result = validationDetails(issues)
      expect(result.fields[0]?.path).toBe('')
    })

    it('preserves original error messages', () => {
      const issues = [
        { path: ['email'], message: 'Invalid email format' },
        { path: ['password'], message: 'Must be at least 8 characters' },
      ]
      const result = validationDetails(issues)
      expect(result.fields[0]?.message).toBe('Invalid email format')
      expect(result.fields[1]?.message).toBe('Must be at least 8 characters')
    })
  })

  describe('error codes coverage', () => {
    it('all error codes are defined and have messages', () => {
      const codes = Object.values(AuthErrorCode)
      expect(codes.length).toBeGreaterThan(0)
      for (const code of codes) {
        const error = authError(code)
        expect(error.message).toBeTruthy()
        expect(error.message.length).toBeGreaterThan(0)
      }
    })
  })

  describe('error response structure', () => {
    it('response is serializable to JSON', () => {
      const error = authError(AuthErrorCode.InvalidPassword, { field: 'password' })
      const json = JSON.stringify(error)
      const parsed = JSON.parse(json)
      expect(parsed.code).toBe('INVALID_PASSWORD')
      expect(parsed.message).toBeDefined()
      expect(parsed.details).toBeDefined()
    })

    it('error code is uppercase in JSON', () => {
      const error = authError(AuthErrorCode.Unauthorized)
      const json = JSON.stringify(error)
      expect(json).toContain('"code":"UNAUTHORIZED"')
    })
  })
})
