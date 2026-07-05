import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { AuthErrorCode, authError } from './errors'

/**
 * A Fastify `preHandler` that rejects the request with 401 unless it carries a valid session
 * or API key. Attach via `{ preHandler: requireAuth(app) }` so authenticated routes don't each
 * repeat the try/catch. (Session-vs-key scoping is a follow-up — see #73.)
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
