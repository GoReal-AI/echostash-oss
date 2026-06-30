import type { FastifyInstance } from 'fastify'
import { AuthType } from '../auth/enums'
import { AuthErrorCode, authError } from '../auth/errors'

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/settings
   * Public endpoint: returns workspace info the UI needs (e.g., is auth required).
   */
  app.get('/settings', async () => {
    return {
      authRequired: true,
      apiKeysEnabled: true,
    }
  })

  /**
   * GET /api/settings/me
   * Authenticated endpoint: returns the current user/auth context.
   */
  app.get('/settings/me', async (request, reply) => {
    try {
      const auth = await app.authenticate(request)
      if (auth.type === AuthType.Session) {
        return {
          authType: AuthType.Session,
          role: 'admin',
        }
      }
      return {
        authType: AuthType.ApiKey,
        apiKeyName: auth.apiKeyName,
      }
    } catch {
      return reply.code(401).send(authError(AuthErrorCode.Unauthorized))
    }
  })
}
