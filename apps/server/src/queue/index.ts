import { Queue } from 'bullmq'
import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'

/** BullMQ queue name — a runner worker must consume the same name (see @echostash/runner worker). */
export const EVAL_QUEUE = 'eval'

export interface EvalJob {
  evalRunId: string
}

/** Parse a redis:// URL into BullMQ connection options (it manages the ioredis client itself). */
function redisConnection(url: string) {
  const u = new URL(url)
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 6379,
    username: u.username || undefined,
    password: u.password || undefined,
    db: u.pathname && u.pathname.length > 1 ? Number(u.pathname.slice(1)) : undefined,
  }
}

/**
 * Registers `app.enqueueEval(runId)`. With `REDIS_URL` set it pushes a job onto the BullMQ queue a
 * runner worker consumes. Without Redis it degrades gracefully — the run is still created `pending`,
 * and any runner can drive it via the API (`GET /spec` → run → `POST /results`); we just don't
 * auto-dispatch. Returns whether the job was actually enqueued.
 */
export const queuePlugin = fp(
  async function queuePlugin(app: FastifyInstance): Promise<void> {
    const url = app.env.REDIS_URL
    if (!url) {
      app.log.warn(
        'REDIS_URL not set — eval runs are created but not auto-dispatched. Start a runner worker ' +
          'against the same Redis, or drive runs manually via the API.',
      )
      app.decorate('enqueueEval', async () => false)
      return
    }

    const queue = new Queue<EvalJob>(EVAL_QUEUE, { connection: redisConnection(url) })
    app.decorate('enqueueEval', async (evalRunId: string) => {
      await queue.add('run', { evalRunId }, { removeOnComplete: 100, removeOnFail: 500 })
      return true
    })
    app.addHook('onClose', async () => {
      await queue.close()
    })
    app.log.info('eval queue connected (BullMQ)')
  },
  { name: 'queue' },
)

declare module 'fastify' {
  interface FastifyInstance {
    enqueueEval: (evalRunId: string) => Promise<boolean>
  }
}
