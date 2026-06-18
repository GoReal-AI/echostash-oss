import type { ScanReport, ScanReportResult } from '@echostash/shared'
import { and, eq, sql } from 'drizzle-orm'
import type { Database } from '../../db/client'
import { promptSnapshots, prompts, scanRuns, sources } from '../../db/schema'
import { sha256 } from '../../lib/hash'

/**
 * Upsert a scan report: prompts by fingerprint, snapshots by (contentHash, configHash).
 * A new snapshot row = a detected change (new content OR new model/params).
 */
export async function ingestScan(db: Database, report: ScanReport): Promise<ScanReportResult> {
  const { context } = report

  // 1. resolve/create the source
  const existingSource = await db
    .select()
    .from(sources)
    .where(and(eq(sources.kind, 'local_scan'), eq(sources.name, context.sourceName)))
    .limit(1)
  let sourceId = existingSource[0]?.id
  if (!sourceId) {
    const inserted = await db
      .insert(sources)
      .values({ kind: 'local_scan', name: context.sourceName, config: {} })
      .returning({ id: sources.id })
    sourceId = inserted[0]?.id
  }
  if (!sourceId) throw new Error('failed to create source')

  // 2. open a scan run
  const runRows = await db
    .insert(scanRuns)
    .values({ sourceId, gitSha: context.gitSha, gitRef: context.gitRef, status: 'running' })
    .returning({ id: scanRuns.id })
  const scanRunId = runRows[0]?.id
  if (!scanRunId) throw new Error('failed to create scan run')

  // 3. upsert prompts + snapshots
  let changes = 0
  for (const dp of report.prompts) {
    const promptRows = await db
      .insert(prompts)
      .values({ fingerprint: dp.fingerprint, name: dp.name, type: 'prompt' })
      .onConflictDoUpdate({ target: prompts.fingerprint, set: { lastSeenAt: new Date() } })
      .returning({ id: prompts.id })
    const promptId = promptRows[0]?.id
    if (!promptId) continue

    const contentHash = sha256({ messages: dp.messages, content: dp.content })
    const configHash = sha256({ provider: dp.provider, model: dp.model, params: dp.params })

    const inserted = await db
      .insert(promptSnapshots)
      .values({
        promptId,
        contentHash,
        configHash,
        content: dp.content,
        messages: dp.messages,
        provider: dp.provider,
        model: dp.model,
        params: dp.params,
        resolution: dp.resolution,
        sourceId,
        gitSha: context.gitSha,
        gitRef: context.gitRef,
        filePath: dp.filePath,
        symbol: dp.symbol,
      })
      .onConflictDoNothing({
        target: [promptSnapshots.promptId, promptSnapshots.contentHash, promptSnapshots.configHash],
      })
      .returning({ id: promptSnapshots.id })

    if (inserted.length > 0) {
      changes++
    } else {
      await db
        .update(promptSnapshots)
        .set({ lastSeenAt: new Date(), seenCount: sql`${promptSnapshots.seenCount} + 1` })
        .where(
          and(
            eq(promptSnapshots.promptId, promptId),
            eq(promptSnapshots.contentHash, contentHash),
            eq(promptSnapshots.configHash, configHash),
          ),
        )
    }
  }

  // 4. close the scan run
  await db
    .update(scanRuns)
    .set({
      status: 'done',
      promptsFound: report.prompts.length,
      changesDetected: changes,
      finishedAt: new Date(),
    })
    .where(eq(scanRuns.id, scanRunId))

  return { scanRunId, promptsFound: report.prompts.length, changesDetected: changes }
}
