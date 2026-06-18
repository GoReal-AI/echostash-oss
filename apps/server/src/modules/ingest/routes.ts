import { ScanReport } from '@echostash/shared'
import type { FastifyInstance } from 'fastify'
import { ingestScan } from './service'

export async function ingestRoutes(app: FastifyInstance): Promise<void> {
  app.post('/ingest/scan', async (request, reply) => {
    const parsed = ScanReport.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid scan report', issues: parsed.error.issues })
    }
    const result = await ingestScan(app.db, parsed.data)
    return reply.code(201).send(result)
  })
}
