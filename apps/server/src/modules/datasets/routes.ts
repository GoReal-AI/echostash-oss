import { asc, eq, sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { datasetCases, datasets } from '../../db/schema'
import { requireAuth } from '../auth/guard'
import { CreateCase, CreateDataset, UpdateCase, UpdateDataset, slugify } from './schema'

const badRequest = (reply: import('fastify').FastifyReply, error: unknown) =>
  reply.code(400).send({ error: 'invalid request', details: error })

export async function datasetRoutes(app: FastifyInstance): Promise<void> {
  const auth = { preHandler: requireAuth(app) }

  // List datasets (optionally scoped to a prompt), each with its case count.
  app.get<{ Querystring: { promptId?: string } }>('/datasets', auth, async (request) => {
    const rows = await app.db
      .select({
        id: datasets.id,
        name: datasets.name,
        slug: datasets.slug,
        description: datasets.description,
        promptId: datasets.promptId,
        createdAt: datasets.createdAt,
        caseCount: sql<number>`count(${datasetCases.id})::int`,
      })
      .from(datasets)
      .leftJoin(datasetCases, eq(datasetCases.datasetId, datasets.id))
      .groupBy(datasets.id)
      .orderBy(asc(datasets.name))
    const { promptId } = request.query
    return promptId ? rows.filter((d) => d.promptId === promptId) : rows
  })

  // Create a dataset.
  app.post('/datasets', auth, async (request, reply) => {
    const parsed = CreateDataset.safeParse(request.body)
    if (!parsed.success) return badRequest(reply, parsed.error.issues)
    const { name, slug, description, promptId } = parsed.data
    const [row] = await app.db
      .insert(datasets)
      .values({
        name,
        slug: slug ?? slugify(name),
        description: description ?? null,
        promptId: promptId ?? null,
      })
      .returning()
    return reply.code(201).send(row)
  })

  // A dataset with its ordered cases.
  app.get<{ Params: { id: string } }>('/datasets/:id', auth, async (request, reply) => {
    const [dataset] = await app.db
      .select()
      .from(datasets)
      .where(eq(datasets.id, request.params.id))
      .limit(1)
    if (!dataset) return reply.code(404).send({ error: 'dataset not found' })
    const cases = await app.db
      .select()
      .from(datasetCases)
      .where(eq(datasetCases.datasetId, dataset.id))
      .orderBy(asc(datasetCases.position))
    return { dataset, cases }
  })

  // Update a dataset's metadata.
  app.patch<{ Params: { id: string } }>('/datasets/:id', auth, async (request, reply) => {
    const parsed = UpdateDataset.safeParse(request.body)
    if (!parsed.success) return badRequest(reply, parsed.error.issues)
    if (Object.keys(parsed.data).length === 0)
      return reply.code(400).send({ error: 'no fields to update' })
    const [row] = await app.db
      .update(datasets)
      .set(parsed.data)
      .where(eq(datasets.id, request.params.id))
      .returning()
    if (!row) return reply.code(404).send({ error: 'dataset not found' })
    return row
  })

  // Delete a dataset (cases cascade).
  app.delete<{ Params: { id: string } }>('/datasets/:id', auth, async (request, reply) => {
    const [row] = await app.db
      .delete(datasets)
      .where(eq(datasets.id, request.params.id))
      .returning({ id: datasets.id })
    if (!row) return reply.code(404).send({ error: 'dataset not found' })
    return { deleted: true }
  })

  // Add a case to a dataset. New cases append to the end unless `position` is given.
  app.post<{ Params: { id: string } }>('/datasets/:id/cases', auth, async (request, reply) => {
    const parsed = CreateCase.safeParse(request.body)
    if (!parsed.success) return badRequest(reply, parsed.error.issues)
    const [dataset] = await app.db
      .select({ id: datasets.id })
      .from(datasets)
      .where(eq(datasets.id, request.params.id))
      .limit(1)
    if (!dataset) return reply.code(404).send({ error: 'dataset not found' })

    const { name, input, messages, expected, source, position } = parsed.data
    let pos = position
    if (pos === undefined) {
      const [max] = await app.db
        .select({ max: sql<number>`coalesce(max(${datasetCases.position}), -1)::int` })
        .from(datasetCases)
        .where(eq(datasetCases.datasetId, dataset.id))
      pos = (max?.max ?? -1) + 1
    }
    const [row] = await app.db
      .insert(datasetCases)
      .values({
        datasetId: dataset.id,
        name,
        input,
        messages: messages ?? undefined,
        expected: expected ?? null,
        source,
        position: pos,
      })
      .returning()
    return reply.code(201).send(row)
  })

  // Update a case.
  app.patch<{ Params: { id: string } }>('/cases/:id', auth, async (request, reply) => {
    const parsed = UpdateCase.safeParse(request.body)
    if (!parsed.success) return badRequest(reply, parsed.error.issues)
    if (Object.keys(parsed.data).length === 0)
      return reply.code(400).send({ error: 'no fields to update' })
    const [row] = await app.db
      .update(datasetCases)
      .set(parsed.data)
      .where(eq(datasetCases.id, request.params.id))
      .returning()
    if (!row) return reply.code(404).send({ error: 'case not found' })
    return row
  })

  // Delete a case.
  app.delete<{ Params: { id: string } }>('/cases/:id', auth, async (request, reply) => {
    const [row] = await app.db
      .delete(datasetCases)
      .where(eq(datasetCases.id, request.params.id))
      .returning({ id: datasetCases.id })
    if (!row) return reply.code(404).send({ error: 'case not found' })
    return { deleted: true }
  })
}
