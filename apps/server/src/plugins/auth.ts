import { createHash, timingSafeEqual } from 'node:crypto'
import fastifyCookie from '@fastify/cookie'
import fastifyJwt from '@fastify/jwt'
import { eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import type { Database } from '../db/client'
import { apiKeys } from '../db/schema'
import type { Env } from '../env'
import { AuthType, SESSION_COOKIE_NAME } from '../modules/auth/enums'

/** sha256 hex length — used as the dummy comparison target on a key miss. */
const SHA256_HEX_LEN = 64
const DUMMY_HASH = '0'.repeat(SHA256_HEX_LEN)

/**
 * The indexed lookup prefix stored next to each key, e.g. "ek_1a2b3c4d". Long enough (8 hex
 * chars ≈ 32 bits) that the column's unique constraint won't collide in practice; still leaves
 * the remaining ~160 bits of the key secret. createApiKey and verifyApiKey MUST derive it the
 * same way, so both go through this helper.
 */
export const API_KEY_PREFIX = 'ek_'
const API_KEY_PREFIX_LEN = API_KEY_PREFIX.length + 8

export function apiKeyPrefix(fullKey: string): string {
  return fullKey.slice(0, API_KEY_PREFIX_LEN)
}

/** Only refresh apiKeys.lastUsedAt when the stored value is older than this, to bound writes. */
const LAST_USED_THROTTLE_MS = 5 * 60 * 1000

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/**
 * Constant-time comparison of two equal-length hex strings. Returns false on length mismatch
 * (for fixed-length sha256 hashes the length is not secret).
 */
export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex')
  const bb = Buffer.from(b, 'hex')
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

/**
 * Auth context returned by authenticate().
 * Either sessionId or apiKeyId is present, never both.
 */
export interface AuthContext {
  type: AuthType
  sessionId?: string
  apiKeyId?: string
  apiKeyName?: string
}

/**
 * Fastify plugin: registers JWT handling + API key verification.
 * Provides app.authenticate() to route handlers for opt-in auth guards.
 *
 * Wrapped with fastify-plugin so its decorators (jwt, cookie, authenticate) escape this
 * plugin's encapsulation and are visible to sibling route plugins on the root instance.
 */
export const authPlugin = fp(
  async function authPlugin(app: FastifyInstance): Promise<void> {
    const env = app.env as Env

    // Register cookie plugin for session storage
    await app.register(fastifyCookie)

    // Register JWT plugin for session handling. The `cookie` option lets jwtVerify() read the
    // session token from the httpOnly `session` cookie (set on login), not just the
    // Authorization header — so browser requests authenticate via the cookie.
    await app.register(fastifyJwt, {
      secret: env.SESSION_SECRET,
      sign: {
        expiresIn: '7d',
      },
      cookie: {
        cookieName: SESSION_COOKIE_NAME,
        signed: false,
      },
    })

    /**
     * Authenticate a request: verify either a valid session JWT or a valid API key.
     * Returns the auth context or throws 401.
     * Called opt-in by route handlers that require auth.
     */
    app.decorate(
      'authenticate',
      async function authenticate(request: FastifyRequest): Promise<AuthContext> {
        // Try JWT from Authorization header or cookie
        try {
          await request.jwtVerify()
          const payload = request.user as { type?: string; sessionId?: string }
          return {
            type: AuthType.Session,
            sessionId: payload.sessionId,
          }
        } catch {
          // JWT failed; fall through to API key check
        }

        // Try API key from Authorization: Bearer header
        const authHeader = request.headers.authorization
        if (authHeader?.startsWith('Bearer ')) {
          const key = authHeader.slice(7)
          const context = await verifyApiKey(app, key)
          if (context) {
            return context
          }
        }

        // No valid auth
        throw new Error('Unauthorized')
      },
    )
  },
  { name: 'auth' },
)

/**
 * Verify an API key: look it up by prefix, then compare hashes in constant time.
 * A miss compares against a dummy hash so present/absent keys take the same time.
 * On success, refreshes lastUsedAt (throttled, best-effort). Returns context or null.
 */
async function verifyApiKey(app: FastifyInstance, fullKey: string): Promise<AuthContext | null> {
  const db = app.db as Database

  if (!fullKey.startsWith(API_KEY_PREFIX)) return null

  const prefix = apiKeyPrefix(fullKey)
  const providedHash = sha256Hex(fullKey)

  const rows = await db.select().from(apiKeys).where(eq(apiKeys.prefix, prefix)).limit(1)
  const key = rows[0]

  // Always run the comparison (against a dummy on miss) to avoid leaking key existence by timing.
  const storedHash = key?.hash ?? DUMMY_HASH
  const hashMatches = safeEqualHex(storedHash, providedHash)

  if (!key || key.revokedAt || !hashMatches) {
    return null
  }

  // Refresh lastUsedAt at most once per throttle window — collapses per-request writes.
  // We already have the row, so no extra read; best-effort so it never fails/slows auth.
  const lastUsed = key.lastUsedAt?.getTime() ?? 0
  if (Date.now() - lastUsed > LAST_USED_THROTTLE_MS) {
    void db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, key.id))
      .catch((err) => app.log.warn({ err }, 'apiKey.lastUsedAt update failed'))
  }

  return {
    type: AuthType.ApiKey,
    apiKeyId: key.id,
    apiKeyName: key.name,
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<AuthContext>
    env: Env
  }
}
