import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

const ScanRunsQuery = z.object({
  sourceId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
})

const ChangeFeedQuery = z.object({
  sourceId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
})

export async function scanRunsRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/scan-runs — read recent scan runs
  app.get('/scan-runs', async (request, reply) => {
    const parsed = ScanRunsQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid query params', issues: parsed.error.issues })
    }

    const { sourceId, limit } = parsed.data
    const runs = await app.db.query.scanRuns.findMany({
      where: sourceId ? (r, { eq }) => eq(r.sourceId, sourceId) : undefined,
      orderBy: (r, { desc }) => [desc(r.startedAt)],
      limit,
    })

    return reply.send(runs)
  })

  // GET /api/scan-runs/:id — read single scan run
  app.get('/scan-runs/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const run = await app.db.query.scanRuns.findFirst({
      where: (r, { eq }) => eq(r.id, id),
    })

    if (!run) {
      return reply.code(404).send({ error: 'scan run not found' })
    }

    return reply.send(run)
  })

  // GET /api/change-feed — read recent prompt snapshots and changes
  app.get('/change-feed', async (request, reply) => {
    const parsed = ChangeFeedQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid query params', issues: parsed.error.issues })
    }

    const { sourceId, limit } = parsed.data
    const snapshots = await app.db.query.promptSnapshots.findMany({
      where: sourceId ? (s, { eq }) => eq(s.sourceId, sourceId) : undefined,
      orderBy: (s, { desc }) => [desc(s.firstSeenAt)],
      limit,
    })

    return reply.send(snapshots)
  })
}
