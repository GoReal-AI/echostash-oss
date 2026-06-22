import { realpathSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { type ScanReport, ScanReport as ScanReportSchema } from '@echostash/shared'
import { eq } from 'drizzle-orm'
import { loadEnv } from '../env'
import { sha256 } from '../lib/hash'
import { ingestScan } from '../modules/ingest/service'
import { type Database, createDb } from './client'
import {
  datasetCases,
  datasets,
  evalRunCells,
  evalRuns,
  evalScores,
  projects,
  promptSnapshots,
  promptTags,
  prompts,
  scanRuns,
  scorers,
  sources,
  tags,
  variants,
} from './schema'

/**
 * Seed a fresh clone with demo data so every screen has something to show:
 *   1. a sample repo scan  → sources + scan_runs + prompts + prompt_snapshots (with a change timeline)
 *   2. datasets            → datasets + dataset_cases
 *   3. an eval run         → variants + eval_runs + eval_run_cells + eval_scores
 *
 * The scan part reuses the real ingest path (`ingestScan`) so the seeded prompts/snapshots are
 * derived exactly like a live scan. The server never calls an LLM, so the eval results are
 * inserted directly as plausible-looking rows.
 *
 * Idempotent: clears the seeded tables first, so re-running won't pile up duplicates.
 *   pnpm db:seed
 */

const SOURCE_NAME = 'echostash-demo'

/** v1 of the scanned repo — three prompts at three call sites. */
const SCAN_V1: ScanReport = {
  context: {
    sourceName: SOURCE_NAME,
    gitSha: 'a1b2c3d000000000000000000000000000000001',
    gitRef: 'refs/heads/main',
    repoUrl: 'https://github.com/example/echostash-demo',
  },
  prompts: [
    {
      fingerprint: 'src/agent.ts::supportAgent',
      name: 'supportAgent',
      content: [],
      messages: [
        { role: 'system', content: 'You are a helpful customer-support agent for Acme Corp.' },
        { role: 'user', content: '{{question}}' },
      ],
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
      params: { temperature: 0.2, maxTokens: 1024 },
      resolution: 'partial',
      filePath: 'src/agent.ts',
      symbol: 'supportAgent',
      line: 12,
    },
    {
      fingerprint: 'src/openai-chat.ts::summarize',
      name: 'summarize',
      content: [{ type: 'text', text: 'Summarize the following text in one sentence.' }],
      messages: [
        { role: 'system', content: 'Summarize the following text in one sentence.' },
        { role: 'user', content: '{{document}}' },
      ],
      provider: 'openai',
      model: 'gpt-4o',
      params: { temperature: 0, maxTokens: 256 },
      resolution: 'resolved',
      filePath: 'src/openai-chat.ts',
      symbol: 'summarize',
      line: 8,
    },
    {
      fingerprint: 'prompts/reviewer.st::reviewer',
      name: 'reviewer',
      content: [{ type: 'text', text: 'You are a strict code reviewer. List issues as bullets.' }],
      messages: [
        { role: 'system', content: 'You are a strict code reviewer. List issues as bullets.' },
        { role: 'user', content: '{{diff}}' },
      ],
      provider: 'anthropic',
      model: 'claude-3-5-haiku',
      params: { temperature: 0.4 },
      resolution: 'resolved',
      filePath: 'prompts/reviewer.st',
      symbol: 'reviewer',
      line: 1,
    },
  ],
}

/**
 * v2 of the same repo — a later commit where `summarize` was edited (content + model bumped).
 * Re-ingesting this produces a *new* snapshot for that prompt → a change timeline in the UI.
 */
const SCAN_V2: ScanReport = {
  context: {
    sourceName: SOURCE_NAME,
    gitSha: 'a1b2c3d000000000000000000000000000000002',
    gitRef: 'refs/heads/main',
    repoUrl: 'https://github.com/example/echostash-demo',
  },
  prompts: SCAN_V1.prompts.map((p) =>
    p.name === 'summarize'
      ? {
          ...p,
          content: [{ type: 'text', text: 'Summarize the following text in two sentences.' }],
          messages: [
            { role: 'system', content: 'Summarize the following text in two sentences.' },
            { role: 'user', content: '{{document}}' },
          ],
          model: 'gpt-4o-mini',
        }
      : p,
  ),
}

/** Delete all seeded rows, children-first, so a re-run starts clean. */
async function clear(db: Database): Promise<void> {
  await db.delete(evalScores)
  await db.delete(evalRunCells)
  await db.delete(evalRuns)
  await db.delete(variants)
  await db.delete(datasetCases)
  await db.delete(datasets)
  await db.delete(scorers)
  await db.delete(promptTags)
  await db.delete(promptSnapshots)
  await db.delete(scanRuns)
  await db.delete(prompts)
  await db.delete(tags)
  await db.delete(sources)
  await db.delete(projects)
}

export async function seed(db: Database): Promise<void> {
  await clear(db)

  // 1. Sample repo scan — ingest twice to create a change timeline.
  ScanReportSchema.parse(SCAN_V1)
  ScanReportSchema.parse(SCAN_V2)
  const r1 = await ingestScan(db, SCAN_V1)
  const r2 = await ingestScan(db, SCAN_V2)
  console.log(`  scan: ${r1.promptsFound} prompts, +${r2.changesDetected} change(s) on re-scan`)

  // Grab the prompt we'll attach the eval to (the edited one shows a timeline nicely).
  const summarize = (await db.select().from(prompts)).find((p) => p.name === 'summarize')
  if (!summarize) throw new Error('seed: expected prompt "summarize" after scan')

  // 2. Dataset + cases.
  const [dataset] = await db
    .insert(datasets)
    .values({
      promptId: summarize.id,
      name: 'Summarization goldens',
      slug: 'summarization-goldens',
      description: 'A few hand-written cases for the summarize prompt.',
    })
    .returning()
  if (!dataset) throw new Error('seed: failed to create dataset')

  const caseRows = await db
    .insert(datasetCases)
    .values([
      {
        datasetId: dataset.id,
        name: 'short article',
        input: { document: 'The quick brown fox jumps over the lazy dog. It was a sunny day.' },
        expected: { contains: 'fox' },
        position: 0,
      },
      {
        datasetId: dataset.id,
        name: 'product release',
        input: {
          document: 'Acme launched a new widget today with 2x battery life and a lower price.',
        },
        expected: { contains: 'widget' },
        position: 1,
      },
      {
        datasetId: dataset.id,
        name: 'empty-ish',
        input: { document: 'ok.' },
        expected: null,
        position: 2,
      },
    ])
    .returning()

  // 3. Scorer + two variants (the eval-matrix columns).
  const [scorer] = await db
    .insert(scorers)
    .values({ name: 'contains-keyword', type: 'deterministic', config: { path: 'contains' } })
    .returning()
  if (!scorer) throw new Error('seed: failed to create scorer')

  const variantRows = await db
    .insert(variants)
    .values([
      {
        promptId: summarize.id,
        name: 'baseline (gpt-4o-mini)',
        messages: SCAN_V2.prompts.find((p) => p.name === 'summarize')?.messages ?? [],
        provider: 'openai',
        model: 'gpt-4o-mini',
        params: { temperature: 0 },
        source: 'snapshot',
      },
      {
        promptId: summarize.id,
        name: 'candidate (claude-sonnet-4-5)',
        messages: SCAN_V2.prompts.find((p) => p.name === 'summarize')?.messages ?? [],
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
        params: { temperature: 0 },
        source: 'sandbox',
      },
    ])
    .returning()

  // 4. Eval run — one matrix of (variant × case) cells, each with a score.
  const configHash = sha256({ datasetId: dataset.id, variants: variantRows.map((v) => v.id) })
  const [run] = await db
    .insert(evalRuns)
    .values({
      promptId: summarize.id,
      datasetId: dataset.id,
      trigger: 'manual',
      executor: 'cli',
      gitSha: SCAN_V2.context.gitSha,
      configHash,
      status: 'done',
      durationMs: 4200,
    })
    .returning()
  if (!run) throw new Error('seed: failed to create eval run')

  let total = 0
  let passed = 0
  for (const variant of variantRows) {
    for (const [i, c] of caseRows.entries()) {
      // Make the candidate variant pass one more case than the baseline, for a visible diff.
      const isPass = !(i === 2 && variant.source === 'snapshot')
      const [cell] = await db
        .insert(evalRunCells)
        .values({
          runId: run.id,
          variantId: variant.id,
          caseId: c.id,
          outputText: `A one-line summary of: ${c.name}.`,
          promptTokens: 120 + i * 10,
          completionTokens: 24 + i * 4,
          totalTokens: 144 + i * 14,
          costUsd: '0.0008',
          latencyMs: 600 + i * 50,
        })
        .returning()
      if (!cell) continue
      await db.insert(evalScores).values({
        cellId: cell.id,
        scorerId: scorer.id,
        value: isPass ? '1' : '0',
        passed: isPass,
        detail: { scorer: 'contains-keyword' },
      })
      total++
      if (isPass) passed++
    }
  }

  await db
    .update(evalRuns)
    .set({
      summaryTotal: total,
      summaryPassed: passed,
      summaryFailed: total - passed,
      score: total > 0 ? (passed / total).toFixed(2) : '0',
    })
    .where(eq(evalRuns.id, run.id))

  console.log(`  eval: ${variantRows.length} variants × ${caseRows.length} cases = ${total} cells`)
}

function isRunDirectly(): boolean {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href
  } catch {
    return false
  }
}

if (isRunDirectly()) {
  const env = loadEnv()
  const { db, client } = createDb(env.DATABASE_URL)
  console.log('Seeding demo data…')
  seed(db)
    .then(async () => {
      await client.end({ timeout: 5 })
      console.log('Seed complete.')
      process.exit(0)
    })
    .catch(async (err) => {
      await client.end({ timeout: 5 })
      console.error('Seed failed:', err)
      process.exit(1)
    })
}
