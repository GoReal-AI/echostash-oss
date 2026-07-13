import { asc, desc, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { datasets, evalRunCells, evalRuns, evalScores, prompts } from '../../db/schema'
import { requireAuth } from '../auth/guard'
import { CreateEvalRun, EvalResult, UpdateStatus } from './schema'
import { buildSpec, configHashOf, ingestResult } from './service'

const badRequest = (reply: import('fastify').FastifyReply, error: unknown) =>
  reply.code(400).send({ error: 'invalid request', details: error })

export async function evalRunRoutes(app: FastifyInstance): Promise<void> {
  const auth = { preHandler: requireAuth(app) }

  // Create a run (status `pending`). A runner then fetches the spec, executes, and posts results.
  // (The queue that dispatches to a worker lands in #61; until then any runner can drive it.)
  app.post('/eval-runs', auth, async (request, reply) => {
    const parsed = CreateEvalRun.safeParse(request.body)
    if (!parsed.success) return badRequest(reply, parsed.error.issues)
    const { promptId, datasetId, variantIds, scorerIds, sampleCount, trigger } = parsed.data

    const [prompt] = await app.db
      .select({ id: prompts.id })
      .from(prompts)
      .where(eq(prompts.id, promptId))
      .limit(1)
    if (!prompt) return reply.code(404).send({ error: 'prompt not found' })
    const [dataset] = await app.db
      .select({ id: datasets.id })
      .from(datasets)
      .where(eq(datasets.id, datasetId))
      .limit(1)
    if (!dataset) return reply.code(404).send({ error: 'dataset not found' })

    const [row] = await app.db
      .insert(evalRuns)
      .values({
        promptId,
        datasetId,
        variantIds,
        scorerIds,
        sampleCount,
        trigger,
        executor: 'worker',
        configHash: configHashOf({ datasetId, variantIds, scorerIds, sampleCount }),
        status: 'pending',
      })
      .returning({ id: evalRuns.id, status: evalRuns.status })
    const dispatched = row ? await app.enqueueEval(row.id) : false
    app.log.info({ evalRunId: row?.id, dispatched }, 'eval run created')
    return reply.code(201).send({ ...row, dispatched })
  })

  // List runs, optionally scoped to a prompt.
  app.get<{ Querystring: { promptId?: string } }>('/eval-runs', auth, async (request) => {
    const rows = await app.db.select().from(evalRuns).orderBy(desc(evalRuns.createdAt))
    const { promptId } = request.query
    return promptId ? rows.filter((r) => r.promptId === promptId) : rows
  })

  // Run detail: the run + its cells + scores (the variant × case matrix the UI renders).
  app.get<{ Params: { id: string } }>('/eval-runs/:id', auth, async (request, reply) => {
    const [run] = await app.db
      .select()
      .from(evalRuns)
      .where(eq(evalRuns.id, request.params.id))
      .limit(1)
    if (!run) return reply.code(404).send({ error: 'eval run not found' })
    const cells = await app.db
      .select()
      .from(evalRunCells)
      .where(eq(evalRunCells.runId, run.id))
      .orderBy(asc(evalRunCells.variantId))
    const cellIds = cells.map((c) => c.id)
    const scores = cellIds.length
      ? (await app.db.select().from(evalScores)).filter((s) => cellIds.includes(s.cellId))
      : []
    return { run, cells, scores }
  })

  // Runner-facing: the resolved EvalJobSpec to execute.
  app.get<{ Params: { id: string } }>('/eval-runs/:id/spec', auth, async (request, reply) => {
    const [run] = await app.db
      .select()
      .from(evalRuns)
      .where(eq(evalRuns.id, request.params.id))
      .limit(1)
    if (!run) return reply.code(404).send({ error: 'eval run not found' })
    const built = await buildSpec(app.db, run)
    if ('error' in built) return reply.code(409).send({ error: built.error })
    return built.spec
  })

  // Runner-facing: ingest results, aggregate the summary, mark the run done.
  app.post<{ Params: { id: string } }>('/eval-runs/:id/results', auth, async (request, reply) => {
    const [run] = await app.db
      .select()
      .from(evalRuns)
      .where(eq(evalRuns.id, request.params.id))
      .limit(1)
    if (!run) return reply.code(404).send({ error: 'eval run not found' })
    const parsed = EvalResult.safeParse(request.body)
    if (!parsed.success) return badRequest(reply, parsed.error.issues)
    if (parsed.data.runId !== run.id) return reply.code(400).send({ error: 'runId mismatch' })
    await ingestResult(app.db, run, parsed.data)
    return { ok: true }
  })

  // Runner-facing heartbeat: running while it works, error if it gave up.
  app.post<{ Params: { id: string } }>('/eval-runs/:id/status', auth, async (request, reply) => {
    const parsed = UpdateStatus.safeParse(request.body)
    if (!parsed.success) return badRequest(reply, parsed.error.issues)
    const [row] = await app.db
      .update(evalRuns)
      .set({ status: parsed.data.status, error: parsed.data.error ?? null })
      .where(eq(evalRuns.id, request.params.id))
      .returning({ id: evalRuns.id, status: evalRuns.status })
    if (!row) return reply.code(404).send({ error: 'eval run not found' })
    return row
  })
}
