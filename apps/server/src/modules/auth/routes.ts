import { createId } from '@paralleldrive/cuid2'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { loadEnv } from '../../env'
import { AuthErrorCode, authError, validationDetails } from './errors'
import { clearSessionToken, issueSessionToken, verifyPassword } from './service'

const LoginRequestSchema = z.object({
  password: z.string(),
})

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const env = loadEnv()

  app.post(
    '/auth/login',
    {
      // Brute-force guard: @fastify/rate-limit returns 429 (+ Retry-After) past the budget.
      // Keyed by client IP (see TRUST_PROXY); store is the plugin's bounded LRU. Budget is
      // generous because every request counts, including successful logins.
      config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const parsed = LoginRequestSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .code(400)
          .send(authError(AuthErrorCode.InvalidRequest, validationDetails(parsed.error.issues)))
      }

      if (!verifyPassword(parsed.data.password, env.ADMIN_PASSWORD)) {
        return reply.code(401).send(authError(AuthErrorCode.InvalidPassword))
      }

      const sessionId = createId()
      await issueSessionToken(app, reply, sessionId)
      return reply.code(200).send({ message: 'Logged in successfully' })
    },
  )

  app.post('/auth/logout', async (_request, reply) => {
    clearSessionToken(reply)
    return reply.code(200).send({ message: 'Logged out successfully' })
  })

  /**
   * Check auth status: returns the current session/api-key context.
   * Useful for the UI to know what auth method is active.
   */
  app.get('/auth/status', async (request) => {
    try {
      const auth = await app.authenticate(request)
      return { authenticated: true, type: auth.type, apiKeyName: auth.apiKeyName }
    } catch {
      return { authenticated: false, code: AuthErrorCode.Unauthorized }
    }
  })
}
