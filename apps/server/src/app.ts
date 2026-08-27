import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import Fastify, { type FastifyInstance } from 'fastify'
import type { Database, PgClient } from './db/client'
import type { Env } from './env'
import { loadEnv } from './env'
import { isProduction } from './modules/auth/enums'

/**
 * Map the TRUST_PROXY env string to Fastify's `trustProxy` option: 'true'/'false' toggle it,
 * anything else is a comma-list of trusted IPs/CIDRs. Controls whether X-Forwarded-For is
 * believed when deriving the client IP (used for login rate limiting).
 */
function parseTrustProxy(value: string): boolean | string[] {
  if (value === 'true') return true
  if (value === 'false') return false
  return value.split(',').map((s) => s.trim())
}
import { apiKeysRoutes } from './modules/api-keys/routes'
import { authRoutes } from './modules/auth/routes'
import { datasetRoutes } from './modules/datasets/routes'
import { evalRunRoutes } from './modules/eval-runs/routes'
import { ingestRoutes } from './modules/ingest/routes'
import { promptRoutes } from './modules/prompts/routes'
import { scorerRoutes } from './modules/scorers/routes'
import { settingsRoutes } from './modules/settings/routes'
import { variantRoutes } from './modules/variants/routes'
import { authPlugin } from './plugins/auth'
import { queuePlugin } from './queue'

export interface AppDeps {
  db: Database
  sql: PgClient
}

export async function buildApp({ db, sql }: AppDeps): Promise<FastifyInstance> {
  const env = loadEnv()
  const app = Fastify({
    // Derive the real client IP from a trusted proxy chain instead of believing a spoofable
    // X-Forwarded-For header. Off by default; enable only behind a known proxy/LB.
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      // Never let secrets reach the logs: the API key rides in Authorization, the session in
      // Cookie, and the admin password in the login body. Redacted if any serializer logs them.
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        'req.body.password',
      ],
      transport: isProduction(process.env.NODE_ENV ?? '')
        ? undefined
        : {
            target: 'pino-pretty',
            options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
          },
    },
  })

  await app.register(cors, { origin: true, credentials: true })

  // Rate limiting — registered globally disabled; opted into per-route (e.g. login) via
  // route `config.rateLimit`. The default store is a bounded LRU with TTL eviction (no leak).
  // For multi-instance/persistent limits, pass a Redis store here when REDIS_URL is set.
  await app.register(rateLimit, { global: false })

  // make the db and env available to plugins and route handlers
  app.decorate('db', db)
  app.decorate('env', env)

  // Liveness — process is up.
  app.get('/healthz', async () => ({ status: 'ok' }))

  // Readiness — dependencies reachable.
  app.get('/readyz', async (_req, reply) => {
    try {
      await sql`select 1`
      return { status: 'ready', db: 'ok' }
    } catch (err) {
      app.log.error({ err }, 'readiness check failed')
      return reply.code(503).send({ status: 'not_ready', db: 'error' })
    }
  })

  // Eval dispatch queue (BullMQ/Redis) — degrades to no-op without REDIS_URL.
  await app.register(queuePlugin)

  // M5 — auth: session + API keys + settings
  await app.register(authPlugin)
  await app.register(authRoutes, { prefix: '/api' })
  await app.register(apiKeysRoutes, { prefix: '/api' })
  await app.register(settingsRoutes, { prefix: '/api' })

  // M2 — awareness: scan ingestion + the prompt registry.
  await app.register(ingestRoutes, { prefix: '/api' })
  await app.register(promptRoutes, { prefix: '/api' })

  // M4 — eval: datasets/cases, scorers, variants CRUD + the eval-run lifecycle.
  await app.register(datasetRoutes, { prefix: '/api' })
  await app.register(scorerRoutes, { prefix: '/api' })
  await app.register(variantRoutes, { prefix: '/api' })
  await app.register(evalRunRoutes, { prefix: '/api' })

  return app
}

declare module 'fastify' {
  interface FastifyInstance {
    db: Database
  }
}
