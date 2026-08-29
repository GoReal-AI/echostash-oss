import { Worker } from 'bullmq'
import { z } from '@echostash/shared'
import { httpClient } from './client'
import { processEvalJob } from './job'

/** Must match the server's queue name (apps/server/src/queue → EVAL_QUEUE). */
export const EVAL_QUEUE = 'eval'

export const WorkerEnvSchema = z.object({
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  ECHOSTASH_URL: z.string().url().default('http://localhost:8080'),
  ECHOSTASH_API_KEY: z.string().min(1, 'ECHOSTASH_API_KEY is required (project API key)'),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(4),
  ECHOSTASH_JUDGE_MODEL: z.string().optional(),
})

/** Parse a redis:// URL into BullMQ connection options (it creates the ioredis client itself). */
function redisConnection(url: string) {
  const u = new URL(url)
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 6379,
    username: u.username || undefined,
    password: u.password || undefined,
    db: u.pathname && u.pathname.length > 1 ? Number(u.pathname.slice(1)) : undefined,
    // required by BullMQ for its blocking worker connection
    maxRetriesPerRequest: null,
  }
}

/**
 * Eval runner worker (data plane). Consumes eval jobs from Redis, fetches each job's spec from the
 * control-plane server, runs the matrix with its OWN provider keys, and posts results back. Scale by
 * running more of these; the server never calls an LLM.
 *
 *   REDIS_URL=… ECHOSTASH_URL=… ECHOSTASH_API_KEY=… [ECHOSTASH_JUDGE_MODEL=…] [WORKER_CONCURRENCY=4]
 *   pnpm --filter @echostash/runner worker
 */
function main(): void {
  const env = WorkerEnvSchema.parse({
    REDIS_URL: process.env.REDIS_URL,
    ECHOSTASH_URL: process.env.ECHOSTASH_URL,
    ECHOSTASH_API_KEY: process.env.ECHOSTASH_API_KEY,
    WORKER_CONCURRENCY: process.env.WORKER_CONCURRENCY,
    ECHOSTASH_JUDGE_MODEL: process.env.ECHOSTASH_JUDGE_MODEL,
  })

  const client = httpClient(env.ECHOSTASH_URL, env.ECHOSTASH_API_KEY)

  const worker = new Worker<{ evalRunId: string }>(
    EVAL_QUEUE,
    async (job) => {
      const { evalRunId } = job.data
      console.log(`▶ eval run ${evalRunId}`)
      const result = await processEvalJob(
        { client, judgeSpec: env.ECHOSTASH_JUDGE_MODEL, concurrency: env.WORKER_CONCURRENCY },
        evalRunId,
      )
      console.log(`✓ eval run ${evalRunId} — ${result.summary?.total ?? 0} score(s)`)
    },
    { connection: redisConnection(env.REDIS_URL), concurrency: env.WORKER_CONCURRENCY },
  )

  worker.on('failed', async (job, err) => {
    const evalRunId = job?.data.evalRunId
    console.error(`✗ eval run ${evalRunId}: ${err.message}`)
    if (evalRunId) {
      await client.postStatus(evalRunId, 'error', err.message).catch(() => {})
    }
  })

  worker.on('stalled', (jobId) => {
    console.warn(`! eval job ${jobId} stalled (worker lost or timed out)`)
  })

  console.log(
    `eval worker up — queue "${EVAL_QUEUE}", concurrency ${env.WORKER_CONCURRENCY}, server ${env.ECHOSTASH_URL}`,
  )

  const shutdown = async () => {
    await worker.close()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

const isDirectRun =
  process.argv[1] && /worker\.(ts|js)$/.test(process.argv[1].replace(/\\/g, '/'))
if (isDirectRun) {
  main()
}
