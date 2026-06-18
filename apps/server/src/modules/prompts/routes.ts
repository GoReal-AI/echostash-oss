import { desc, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { promptSnapshots, prompts } from '../../db/schema'

export async function promptRoutes(app: FastifyInstance): Promise<void> {
  // Registry: every discovered prompt with its latest snapshot + snapshot count.
  app.get('/prompts', async () => {
    const promptRows = await app.db.select().from(prompts).orderBy(desc(prompts.lastSeenAt))
    const snaps = await app.db
      .select()
      .from(promptSnapshots)
      .orderBy(desc(promptSnapshots.lastSeenAt))

    const latest = new Map<string, (typeof snaps)[number]>()
    const counts = new Map<string, number>()
    for (const s of snaps) {
      counts.set(s.promptId, (counts.get(s.promptId) ?? 0) + 1)
      if (!latest.has(s.promptId)) latest.set(s.promptId, s)
    }

    return promptRows.map((p) => {
      const s = latest.get(p.id)
      return {
        id: p.id,
        name: p.name,
        fingerprint: p.fingerprint,
        lastSeenAt: p.lastSeenAt,
        snapshotCount: counts.get(p.id) ?? 0,
        model: s?.model ?? null,
        provider: s?.provider ?? null,
        resolution: s?.resolution ?? null,
        filePath: s?.filePath ?? null,
      }
    })
  })

  // Detail: a prompt and its full (append-only) snapshot timeline.
  app.get<{ Params: { id: string } }>('/prompts/:id', async (request, reply) => {
    const rows = await app.db
      .select()
      .from(prompts)
      .where(eq(prompts.id, request.params.id))
      .limit(1)
    const prompt = rows[0]
    if (!prompt) return reply.code(404).send({ error: 'prompt not found' })

    const timeline = await app.db
      .select()
      .from(promptSnapshots)
      .where(eq(promptSnapshots.promptId, prompt.id))
      .orderBy(promptSnapshots.firstSeenAt)

    return { prompt, snapshots: timeline }
  })
}
