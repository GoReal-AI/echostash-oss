import { SCORER_CATALOG } from '@echostash/scoring'
import { asc, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { scorers } from '../../db/schema'
import { requireAuth } from '../auth/guard'
import { CreateScorer, UpdateScorer } from './schema'

const badRequest = (reply: import('fastify').FastifyReply, error: unknown) =>
  reply.code(400).send({ error: 'invalid request', details: error })

export async function scorerRoutes(app: FastifyInstance): Promise<void> {
  const auth = { preHandler: requireAuth(app) }

  // The catalog of families/ops the UI builder renders. Static — no auth needed.
  app.get('/scorers/catalog', async () => SCORER_CATALOG)

  // List all scorers.
  app.get('/scorers', auth, async () => {
    return app.db.select().from(scorers).orderBy(asc(scorers.name))
  })

  // Create a scorer (family/op validated against the catalog).
  app.post('/scorers', auth, async (request, reply) => {
    const parsed = CreateScorer.safeParse(request.body)
    if (!parsed.success) return badRequest(reply, parsed.error.issues)
    const { name, family, op, config, weight, threshold, negate } = parsed.data
    const [row] = await app.db
      .insert(scorers)
      .values({ name, family, op, config, weight, threshold: threshold ?? null, negate })
      .returning()
    return reply.code(201).send(row)
  })

  // Update a scorer's mutable fields (family/op are fixed once created).
  app.patch<{ Params: { id: string } }>('/scorers/:id', auth, async (request, reply) => {
    const parsed = UpdateScorer.safeParse(request.body)
    if (!parsed.success) return badRequest(reply, parsed.error.issues)
    if (Object.keys(parsed.data).length === 0) {
      return reply.code(400).send({ error: 'no fields to update' })
    }
    const [row] = await app.db
      .update(scorers)
      .set(parsed.data)
      .where(eq(scorers.id, request.params.id))
      .returning()
    if (!row) return reply.code(404).send({ error: 'scorer not found' })
    return row
  })

  // Delete a scorer.
  app.delete<{ Params: { id: string } }>('/scorers/:id', auth, async (request, reply) => {
    const [row] = await app.db
      .delete(scorers)
      .where(eq(scorers.id, request.params.id))
      .returning({ id: scorers.id })
    if (!row) return reply.code(404).send({ error: 'scorer not found' })
    return { deleted: true }
  })
}
