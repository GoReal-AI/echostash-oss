import type {
  AssertionOp,
  EvalExecutor,
  EvalStatus,
  EvalTrigger,
  Message,
  ModelParams,
  Provider,
  ScorerFamily,
  ScorerTarget,
  ScorerType,
} from '@echostash/shared'
import { createId } from '@paralleldrive/cuid2'
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import { prompts } from './awareness'

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => createId())

/** The shared atom: (prompt content x model x params). A sandbox edit is just a variant. */
export const variants = pgTable(
  'variants',
  {
    id: id(),
    promptId: text('prompt_id')
      .notNull()
      .references(() => prompts.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    messages: jsonb('messages').$type<Message[]>().notNull().default([]),
    provider: text('provider').$type<Provider>().notNull(),
    model: text('model').notNull(),
    params: jsonb('params').$type<ModelParams>().notNull().default({}),
    source: text('source').$type<'snapshot' | 'sandbox'>().notNull(),
    baseSnapshotId: text('base_snapshot_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('variants_prompt_idx').on(t.promptId)],
)

export const datasets = pgTable('datasets', {
  id: id(),
  promptId: text('prompt_id').references(() => prompts.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const datasetCases = pgTable(
  'dataset_cases',
  {
    id: id(),
    datasetId: text('dataset_id')
      .notNull()
      .references(() => datasets.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    input: jsonb('input').$type<Record<string, unknown>>().notNull().default({}),
    /** optional mocked conversation prepended before the model responds (test a turn in isolation) */
    messages: jsonb('messages').$type<Message[]>(),
    expected: jsonb('expected'),
    source: text('source').$type<'manual' | 'import'>().notNull().default('manual'),
    position: integer('position').notNull().default(0),
  },
  (t) => [index('dataset_cases_dataset_idx').on(t.datasetId)],
)

/** A single check applied to an output — mirrors the shared `Scorer` the runner consumes. */
export const scorers = pgTable('scorers', {
  id: id(),
  name: text('name').notNull(),
  family: text('family').$type<ScorerFamily>().notNull(),
  op: text('op').$type<AssertionOp>().notNull(),
  config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
  target: text('target').$type<ScorerTarget>().notNull().default('response'),
  weight: doublePrecision('weight').notNull().default(1),
  /** pass cutoff for scored (0..1) scorers; null = use the family default */
  threshold: doublePrecision('threshold'),
  negate: boolean('negate').notNull().default(false),
  /** Legacy coarse type, superseded by `family`; kept nullable for back-compat. */
  type: text('type').$type<ScorerType>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const evalRuns = pgTable(
  'eval_runs',
  {
    id: id(),
    promptId: text('prompt_id')
      .notNull()
      .references(() => prompts.id, { onDelete: 'cascade' }),
    datasetId: text('dataset_id')
      .notNull()
      .references(() => datasets.id, { onDelete: 'cascade' }),
    trigger: text('trigger').$type<EvalTrigger>().notNull(),
    executor: text('executor').$type<EvalExecutor>().notNull(),
    gitSha: text('git_sha'),
    configHash: text('config_hash').notNull(),
    /** The run's selection — lets the /spec endpoint rebuild the exact EvalJobSpec. */
    variantIds: jsonb('variant_ids').$type<string[]>().notNull().default([]),
    scorerIds: jsonb('scorer_ids').$type<string[]>().notNull().default([]),
    sampleCount: integer('sample_count').notNull().default(1),
    error: text('error'),
    status: text('status').$type<EvalStatus>().notNull().default('pending'),
    summaryTotal: integer('summary_total').notNull().default(0),
    summaryPassed: integer('summary_passed').notNull().default(0),
    summaryFailed: integer('summary_failed').notNull().default(0),
    summaryErrored: integer('summary_errored').notNull().default(0),
    score: numeric('score'),
    durationMs: integer('duration_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('eval_runs_prompt_idx').on(t.promptId),
    index('eval_runs_config_idx').on(t.configHash),
  ],
)

export const evalRunCells = pgTable(
  'eval_run_cells',
  {
    id: id(),
    runId: text('run_id')
      .notNull()
      .references(() => evalRuns.id, { onDelete: 'cascade' }),
    variantId: text('variant_id').notNull(),
    caseId: text('case_id').notNull(),
    sampleNo: integer('sample_no').notNull().default(0),
    outputText: text('output_text'),
    promptTokens: integer('prompt_tokens'),
    completionTokens: integer('completion_tokens'),
    totalTokens: integer('total_tokens'),
    costUsd: numeric('cost_usd'),
    latencyMs: integer('latency_ms'),
    cached: boolean('cached').notNull().default(false),
  },
  (t) => [index('eval_cells_run_idx').on(t.runId)],
)

export const evalScores = pgTable(
  'eval_scores',
  {
    id: id(),
    cellId: text('cell_id')
      .notNull()
      .references(() => evalRunCells.id, { onDelete: 'cascade' }),
    scorerId: text('scorer_id').notNull(),
    value: numeric('value').notNull(),
    passed: boolean('passed').notNull(),
    detail: jsonb('detail').$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [index('eval_scores_cell_idx').on(t.cellId)],
)
