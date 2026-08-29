import type { FastifyPluginAsync } from 'fastify'
import { ProviderConfig, SetProviderKeyRequest } from '@echostash/shared'
import { AuthType } from '../auth/enums'
import { AuthErrorCode, authError } from '../auth/errors'

export const KNOWN_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', envKey: 'OPENAI_API_KEY' },
  { id: 'anthropic', name: 'Anthropic', envKey: 'ANTHROPIC_API_KEY' },
  { id: 'google', name: 'Google (Gemini)', envKey: 'GEMINI_API_KEY' },
  { id: 'deepseek', name: 'DeepSeek', envKey: 'DEEPSEEK_API_KEY' },
  { id: 'groq', name: 'Groq', envKey: 'GROQ_API_KEY' },
  { id: 'mistral', name: 'Mistral AI', envKey: 'MISTRAL_API_KEY' },
]

// In-memory store for configured workspace provider keys (overrides env)
const configuredKeys = new Map<string, { key: string; updatedAt: string }>()

export function maskKey(key: string): string {
  if (key.length <= 8) return '••••••••'
  return `${key.slice(0, 4)}••••${key.slice(-4)}`
}

export const providerRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /api/providers
   * Returns list of known model providers and whether they are configured in the workspace.
   */
  app.get('/providers', async (request, reply) => {
    try {
      await app.authenticate(request)
    } catch {
      return reply.code(401).send(authError(AuthErrorCode.Unauthorized))
    }

    const result: ProviderConfig[] = KNOWN_PROVIDERS.map((p) => {
      const stored = configuredKeys.get(p.id)
      const envVal = process.env[p.envKey]
      const activeKey = stored?.key ?? envVal

      return {
        provider: p.id,
        name: p.name,
        configured: Boolean(activeKey),
        keyMasked: activeKey ? maskKey(activeKey) : null,
        updatedAt: stored?.updatedAt,
      }
    })

    return reply.send(result)
  })

  /**
   * POST /api/providers/:provider
   * Sets or updates API key for a provider. Restricted to admin session auth.
   */
  app.post<{ Params: { provider: string }; Body: SetProviderKeyRequest }>(
    '/providers/:provider',
    async (request, reply) => {
      let auth
      try {
        auth = await app.authenticate(request)
      } catch {
        return reply.code(401).send(authError(AuthErrorCode.Unauthorized))
      }

      if (auth.type !== AuthType.Session) {
        return reply.code(403).send(authError(AuthErrorCode.Forbidden))
      }

      const { provider } = request.params
      const known = KNOWN_PROVIDERS.find((p) => p.id === provider)
      if (!known) {
        return reply.code(404).send({ error: `unknown provider: ${provider}` })
      }

      const parsed = SetProviderKeyRequest.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid payload', issues: parsed.error.issues })
      }

      const now = new Date().toISOString()
      configuredKeys.set(provider, { key: parsed.data.apiKey, updatedAt: now })

      return reply.send({
        provider,
        name: known.name,
        configured: true,
        keyMasked: maskKey(parsed.data.apiKey),
        updatedAt: now,
      })
    },
  )

  /**
   * DELETE /api/providers/:provider
   * Removes custom API key for a provider. Restricted to admin session auth.
   */
  app.delete<{ Params: { provider: string } }>(
    '/providers/:provider',
    async (request, reply) => {
      let auth
      try {
        auth = await app.authenticate(request)
      } catch {
        return reply.code(401).send(authError(AuthErrorCode.Unauthorized))
      }

      if (auth.type !== AuthType.Session) {
        return reply.code(403).send(authError(AuthErrorCode.Forbidden))
      }

      const { provider } = request.params
      configuredKeys.delete(provider)
      return reply.code(204).send()
    },
  )
}
