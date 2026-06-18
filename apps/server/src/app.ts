import cors from '@fastify/cors'
import Fastify, { type FastifyInstance } from 'fastify'
import type { Database, PgClient } from './db/client'

export interface AppDeps {
  db: Database
  sql: PgClient
}

export async function buildApp({ db, sql }: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport:
        process.env.NODE_ENV === 'production'
          ? undefined
          : {
              target: 'pino-pretty',
              options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
            },
    },
  })

  await app.register(cors, { origin: true, credentials: true })

  // make the db available to route handlers added in later milestones
  app.decorate('db', db)

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

  // Milestone routes (M2+) register under /api here.
  // app.register(promptsModule, { prefix: '/api' })

  return app
}

declare module 'fastify' {
  interface FastifyInstance {
    db: Database
  }
}
