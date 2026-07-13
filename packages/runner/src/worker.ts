import { Worker } from 'bullmq'
import { httpClient } from './client'
import { processEvalJob } from './job'

/** Must match the server's queue name (apps/server/src/queue → EVAL_QUEUE). */
const EVAL_QUEUE = 'eval'

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
  const redisUrl = process.env.REDIS_URL
  const serverUrl = process.env.ECHOSTASH_URL ?? 'http://localhost:8080'
  const apiKey = process.env.ECHOSTASH_API_KEY
  if (!redisUrl) throw new Error('REDIS_URL is required to run the eval worker')
  if (!apiKey)
    throw new Error('ECHOSTASH_API_KEY is required (the project key the worker posts with)')

  const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 4)
  const judgeSpec = process.env.ECHOSTASH_JUDGE_MODEL
  const client = httpClient(serverUrl, apiKey)

  const worker = new Worker<{ evalRunId: string }>(
    EVAL_QUEUE,
    async (job) => {
      const { evalRunId } = job.data
      console.log(`▶ eval run ${evalRunId}`)
      const result = await processEvalJob({ client, judgeSpec, concurrency }, evalRunId)
      console.log(`✓ eval run ${evalRunId} — ${result.summary?.total ?? 0} score(s)`)
    },
    { connection: redisConnection(redisUrl), concurrency },
  )

  worker.on('failed', (job, err) =>
    console.error(`✗ eval run ${job?.data.evalRunId}: ${err.message}`),
  )
  console.log(
    `eval worker up — queue "${EVAL_QUEUE}", concurrency ${concurrency}, server ${serverUrl}`,
  )

  const shutdown = async () => {
    await worker.close()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main()
