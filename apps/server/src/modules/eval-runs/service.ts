import type {
  EvalJobSpec,
  EvalResult,
  Provider,
  Scorer,
  DatasetCase as SharedCase,
  Variant,
} from '@echostash/shared'
import { inArray } from 'drizzle-orm'
import { eq } from 'drizzle-orm'
import type { Database } from '../../db/client'
import {
  datasetCases,
  evalRunCells,
  evalRuns,
  evalScores,
  scorers,
  variants,
} from '../../db/schema'
import { sha256 } from '../../lib/hash'

type EvalRunRow = typeof evalRuns.$inferSelect

/** A run's identity for dedup: same dataset + variants + scorers + samples ⇒ same hash. */
export function configHashOf(input: {
  datasetId: string
  variantIds: string[]
  scorerIds: string[]
  sampleCount: number
}): string {
  return sha256({
    datasetId: input.datasetId,
    variantIds: [...input.variantIds].sort(),
    scorerIds: [...input.scorerIds].sort(),
    sampleCount: input.sampleCount,
  })
}

/** Map a scorers DB row to the shared `Scorer` the runner consumes. */
function toScorer(s: typeof scorers.$inferSelect): Scorer {
  return {
    id: s.id,
    name: s.name,
    family: s.family,
    op: s.op,
    config: s.config,
    target: s.target,
    weight: s.weight,
    threshold: s.threshold ?? undefined,
    negate: s.negate,
  }
}

function toVariant(v: typeof variants.$inferSelect): Variant {
  return {
    id: v.id,
    promptId: v.promptId,
    name: v.name,
    messages: v.messages,
    provider: v.provider,
    model: v.model,
    params: v.params,
    source: v.source,
    baseSnapshotId: v.baseSnapshotId,
  }
}

function toCase(c: typeof datasetCases.$inferSelect): SharedCase {
  return {
    id: c.id,
    datasetId: c.datasetId,
    name: c.name,
    input: c.input,
    messages: c.messages ?? undefined,
    expected: c.expected ?? null,
    source: c.source,
    position: c.position,
  }
}

/**
 * Assemble the `EvalJobSpec` a runner executes, from the run's stored selection. Returns a reason
 * string if it can't be built (a referenced variant/scorer was deleted, or the dataset is empty).
 */
export async function buildSpec(
  db: Database,
  run: EvalRunRow,
): Promise<{ spec: EvalJobSpec } | { error: string }> {
  const [variantRows, caseRows, scorerRows] = await Promise.all([
    run.variantIds.length
      ? db.select().from(variants).where(inArray(variants.id, run.variantIds))
      : Promise.resolve([]),
    db.select().from(datasetCases).where(eq(datasetCases.datasetId, run.datasetId)),
    run.scorerIds.length
      ? db.select().from(scorers).where(inArray(scorers.id, run.scorerIds))
      : Promise.resolve([]),
  ])

  if (variantRows.length === 0)
    return { error: 'no variants found for this run (were they deleted?)' }
  if (scorerRows.length === 0)
    return { error: 'no scorers found for this run (were they deleted?)' }
  if (caseRows.length === 0) return { error: 'the dataset has no cases' }

  const providers = [...new Set(variantRows.map((v) => v.provider))] as Provider[]
  return {
    spec: {
      runId: run.id,
      variants: variantRows.map(toVariant),
      cases: caseRows.map(toCase),
      scorers: scorerRows.map(toScorer),
      sampleCount: run.sampleCount,
      allowedProviders: providers,
    },
  }
}

const num = (n: number | null | undefined): string | null => (n == null ? null : String(n))

/**
 * Persist an `EvalResult`: insert cells, then scores keyed to their cell, then the aggregate
 * summary (using the runner's if given, else computed). Sets the run to `done`.
 */
export async function ingestResult(
  db: Database,
  run: EvalRunRow,
  result: EvalResult,
): Promise<void> {
  const cellKey = (c: { variantId: string; caseId: string; sampleNo: number }) =>
    `${c.variantId}|${c.caseId}|${c.sampleNo}`

  await db.transaction(async (tx) => {
    const idByKey = new Map<string, string>()
    if (result.cells.length > 0) {
      const inserted = await tx
        .insert(evalRunCells)
        .values(
          result.cells.map((c) => ({
            runId: run.id,
            variantId: c.variantId,
            caseId: c.caseId,
            sampleNo: c.sampleNo,
            outputText: c.outputText,
            promptTokens: c.promptTokens,
            completionTokens: c.completionTokens,
            totalTokens: c.totalTokens,
            costUsd: num(c.costUsd),
            latencyMs: c.latencyMs,
            cached: c.cached,
          })),
        )
        .returning({
          id: evalRunCells.id,
          variantId: evalRunCells.variantId,
          caseId: evalRunCells.caseId,
          sampleNo: evalRunCells.sampleNo,
        })
      for (const row of inserted) idByKey.set(cellKey(row), row.id)
    }

    const scoreRows = result.scores
      .map((s) => {
        const cellId = idByKey.get(cellKey(s))
        return cellId
          ? {
              cellId,
              scorerId: s.scorerId,
              value: String(s.value),
              passed: s.passed,
              detail: s.detail,
            }
          : null
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
    if (scoreRows.length > 0) await tx.insert(evalScores).values(scoreRows)

    const s = result.summary
    const passed = s?.passed ?? result.scores.filter((x) => x.passed).length
    const failed = s?.failed ?? result.scores.filter((x) => !x.passed).length
    await tx
      .update(evalRuns)
      .set({
        status: 'done',
        summaryTotal: s?.total ?? result.scores.length,
        summaryPassed: passed,
        summaryFailed: failed,
        summaryErrored: s?.errored ?? 0,
        score: num(s?.score ?? null),
        durationMs: s?.durationMs ?? null,
      })
      .where(eq(evalRuns.id, run.id))
  })
}
