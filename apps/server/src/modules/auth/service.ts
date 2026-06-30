import { createHash } from 'node:crypto'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { safeEqualHex } from '../../plugins/auth'
import { SESSION_COOKIE_NAME, isProduction } from './enums'

/**
 * Verify the password against ADMIN_PASSWORD in constant time. Hashing both sides to sha256
 * first equalizes length (so the comparison leaks neither timing nor the password length).
 */
export function verifyPassword(provided: string, correct: string): boolean {
  const p = createHash('sha256').update(provided).digest('hex')
  const c = createHash('sha256').update(correct).digest('hex')
  return safeEqualHex(p, c)
}

/**
 * Issue a session JWT and set it as an httpOnly, Secure cookie.
 */
export async function issueSessionToken(
  app: FastifyInstance,
  reply: FastifyReply,
  sessionId: string,
): Promise<void> {
  const token = app.jwt.sign({ type: 'session', sessionId })
  reply.setCookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction(process.env.NODE_ENV ?? ''),
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  })
}

/**
 * Clear the session cookie.
 */
export function clearSessionToken(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE_NAME)
}
