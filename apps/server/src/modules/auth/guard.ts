import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { AuthType } from './enums'
import { AuthErrorCode, authError } from './errors'

/**
 * A Fastify `preHandler` that rejects the request with 401 unless it carries a valid session
 * or API key. Attach via `{ preHandler: requireAuth(app) }` so authenticated routes don't each
 * repeat the try/catch.
 */
export function requireAuth(app: FastifyInstance) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      await app.authenticate(request)
    } catch {
      await reply.code(401).send(authError(AuthErrorCode.Unauthorized))
    }
  }
}

/**
 * A Fastify `preHandler` that requires a valid session (admin). Rejects unauthenticated requests
 * with 401 and non-session contexts (e.g. API keys) with 403 Forbidden (#73).
 */
export function requireSession(app: FastifyInstance) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const auth = await app.authenticate(request)
      if (auth.type !== AuthType.Session) {
        await reply.code(403).send(authError(AuthErrorCode.Forbidden))
        return
      }
    } catch {
      await reply.code(401).send(authError(AuthErrorCode.Unauthorized))
    }
  }
}
