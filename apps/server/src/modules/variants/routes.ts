import { desc, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { variants } from '../../db/schema'
import { requireAuth } from '../auth/guard'
import { CreateVariant } from './schema'

export async function variantRoutes(app: FastifyInstance): Promise<void> {
  const auth = { preHandler: requireAuth(app) }

  // List variants, optionally scoped to a prompt.
  app.get<{ Querystring: { promptId?: string } }>('/variants', auth, async (request) => {
    const { promptId } = request.query
    const q = app.db.select().from(variants).orderBy(desc(variants.createdAt))
    const rows = await q
    return promptId ? rows.filter((v) => v.promptId === promptId) : rows
  })

  // Create a variant (prompt content × model × params).
  app.post('/variants', auth, async (request, reply) => {
    const parsed = CreateVariant.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid request', details: parsed.error.issues })
    }
    const { promptId, name, messages, provider, model, params, source, baseSnapshotId } =
      parsed.data
    const [row] = await app.db
      .insert(variants)
      .values({
        promptId,
        name,
        messages,
        provider,
        model,
        params,
        source,
        baseSnapshotId: baseSnapshotId ?? null,
      })
      .returning()
    return reply.code(201).send(row)
  })

  // Delete a variant.
  app.delete<{ Params: { id: string } }>('/variants/:id', auth, async (request, reply) => {
    const [row] = await app.db
      .delete(variants)
      .where(eq(variants.id, request.params.id))
      .returning({ id: variants.id })
    if (!row) return reply.code(404).send({ error: 'variant not found' })
    return { deleted: true }
  })
}
