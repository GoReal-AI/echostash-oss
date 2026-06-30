import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { AuthErrorCode, authError, validationDetails } from '../auth/errors'
import { createApiKey, listApiKeys, revokeApiKey } from './service'

const CreateApiKeyRequestSchema = z.object({
  name: z.string().min(1, 'Name is required'),
})

export async function apiKeysRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/api-keys
   * Create a new API key. Returns the full key (shown only once).
   */
  app.post('/api-keys', async (request, reply) => {
    try {
      await app.authenticate(request)
    } catch {
      return reply.code(401).send(authError(AuthErrorCode.Unauthorized))
    }

    const parsed = CreateApiKeyRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .code(400)
        .send(authError(AuthErrorCode.InvalidRequest, validationDetails(parsed.error.issues)))
    }

    const { name } = parsed.data
    try {
      const key = await createApiKey(app.db, name)
      return reply.code(201).send(key)
    } catch (err) {
      app.log.error({ err }, 'api-key creation failed')
      return reply.code(500).send(authError(AuthErrorCode.KeyCreationFailed))
    }
  })

  /**
   * GET /api/api-keys
   * List all (non-revoked) API keys.
   */
  app.get('/api-keys', async (request, reply) => {
    try {
      await app.authenticate(request)
    } catch {
      return reply.code(401).send(authError(AuthErrorCode.Unauthorized))
    }

    const keys = await listApiKeys(app.db, false)
    return reply.send(keys)
  })

  /**
   * DELETE /api/api-keys/:id
   * Revoke an API key (soft delete).
   */
  app.delete<{ Params: { id: string } }>('/api-keys/:id', async (request, reply) => {
    try {
      await app.authenticate(request)
    } catch {
      return reply.code(401).send(authError(AuthErrorCode.Unauthorized))
    }

    const { id } = request.params
    const revoked = await revokeApiKey(app.db, id)

    if (!revoked) {
      return reply.code(404).send(authError(AuthErrorCode.KeyNotFound))
    }

    return reply.send({ revoked: true })
  })
}
