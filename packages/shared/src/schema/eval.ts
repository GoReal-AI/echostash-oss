import { z } from 'zod'
import { Id, Provider, Timestamp } from './common'
import { Message, ModelParams } from './prompt'

/** Every assertion operator, grouped by family. See docs/EVAL.md. */
export const AssertionOp = z.enum([
  // string / regex
  'contains',
  'not_contains',
  'equals',
  'matches',
  'starts_with',
  'ends_with',
  'length',
  'word_count',
  // structural
  'json_valid',
  'json_schema',
  'yaml_valid',
  // operational
  'latency',
  'token_count',
  'cost',
  // llm-judge
  'judge',
  // tool selection
  'selected_tool',
  // deferred families (forward-compat; engines land per backlog)
  'similar_to',
  'sentiment',
  'self_consistency',
  'tool_called',
  'tool_not_called',
  'tool_call_count',
  'tool_args',
  'tool_call_order',
])
export type AssertionOp = z.infer<typeof AssertionOp>

export const ScorerFamily = z.enum([
  'string',
  'structural',
  'operational',
  'llm_judge',
  'tool_selection',
  // deferred
  'similarity',
  'sentiment',
  'self_consistency',
  'tool',
])
export type ScorerFamily = z.infer<typeof ScorerFamily>

/** Coarse legacy type retained for the scorers DB column; aligns to family at M4. */
export const ScorerType = z.enum(['deterministic', 'llm_judge', 'semantic', 'code', 'human'])
export type ScorerType = z.infer<typeof ScorerType>

export const ScorerTarget = z.enum(['response', 'tool_choice'])
export type ScorerTarget = z.infer<typeof ScorerTarget>

/** A single check applied to an output. See docs/EVAL.md. */
export const Scorer = z.object({
  id: Id,
  name: z.string(),
  family: ScorerFamily,
  op: AssertionOp,
  config: z.record(z.unknown()).default({}),
  target: ScorerTarget.default('response'),
  weight: z.number().default(1),
  /** pass cutoff for scored (0..1) scorers */
  threshold: z.number().optional(),
  /** invert pass/fail — e.g. "must NOT leak confidential info" */
  negate: z.boolean().default(false),
})
export type Scorer = z.infer<typeof Scorer>

export const ScorerStatus = z.enum(['pass', 'fail', 'error'])
export type ScorerStatus = z.infer<typeof ScorerStatus>

/** What the scoring engine returns for one scorer against one output. */
export const ScorerResult = z.object({
  scorerId: Id,
  status: ScorerStatus,
  /** 0..1; boolean scorers report 1 or 0 */
  score: z.number(),
  reason: z.string().optional(),
})
export type ScorerResult = z.infer<typeof ScorerResult>

/** The shared atom: a (prompt content x model x params) combination. */
export const Variant = z.object({
  id: Id,
  promptId: Id,
  name: z.string(),
  messages: z.array(Message).default([]),
  provider: Provider,
  model: z.string(),
  params: ModelParams.default({}),
  source: z.enum(['snapshot', 'sandbox']),
  baseSnapshotId: Id.nullable(),
})
export type Variant = z.infer<typeof Variant>

export const DatasetCase = z.object({
  id: Id,
  datasetId: Id,
  name: z.string(),
  input: z.record(z.unknown()).default({}),
  /** optional mocked conversation prepended before the model responds (test a turn in isolation) */
  messages: z.array(Message).optional(),
  /** gold output for judge / similarity scorers */
  expected: z.unknown().nullable(),
  source: z.enum(['manual', 'import']).default('manual'),
  position: z.number().int().default(0),
})
export type DatasetCase = z.infer<typeof DatasetCase>

export const Dataset = z.object({
  id: Id,
  promptId: Id.nullable(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
})
export type Dataset = z.infer<typeof Dataset>

export const EvalTrigger = z.enum(['sandbox', 'manual', 'ci'])
export type EvalTrigger = z.infer<typeof EvalTrigger>

export const EvalExecutor = z.enum(['worker', 'ci_action', 'cli'])
export type EvalExecutor = z.infer<typeof EvalExecutor>

export const EvalStatus = z.enum(['pending', 'running', 'done', 'error'])
export type EvalStatus = z.infer<typeof EvalStatus>

export const EvalRun = z.object({
  id: Id,
  promptId: Id,
  datasetId: Id,
  trigger: EvalTrigger,
  executor: EvalExecutor,
  gitSha: z.string().nullable(),
  configHash: z.string(),
  status: EvalStatus,
  summaryTotal: z.number().int().default(0),
  summaryPassed: z.number().int().default(0),
  summaryFailed: z.number().int().default(0),
  summaryErrored: z.number().int().default(0),
  score: z.number().nullable(),
  durationMs: z.number().int().nullable(),
  createdAt: Timestamp,
})
export type EvalRun = z.infer<typeof EvalRun>

// ── server <-> runner protocol ──────────────────────────────────────────────

/** The job the control plane hands to a runner. Carries everything needed to execute. */
export const EvalJobSpec = z.object({
  runId: Id,
  variants: z.array(Variant),
  cases: z.array(DatasetCase),
  scorers: z.array(Scorer),
  sampleCount: z.number().int().min(1).default(1),
  /** providers the runner is allowed to call (gates which variants run) */
  allowedProviders: z.array(Provider),
})
export type EvalJobSpec = z.infer<typeof EvalJobSpec>

/** One executed cell of the matrix (variant x case x sample). */
export const EvalResultCell = z.object({
  variantId: Id,
  caseId: Id,
  sampleNo: z.number().int(),
  outputText: z.string(),
  promptTokens: z.number().int().nullable(),
  completionTokens: z.number().int().nullable(),
  totalTokens: z.number().int().nullable(),
  costUsd: z.number().nullable(),
  latencyMs: z.number().int().nullable(),
  cached: z.boolean().default(false),
})
export type EvalResultCell = z.infer<typeof EvalResultCell>

export const EvalResultScore = z.object({
  variantId: Id,
  caseId: Id,
  sampleNo: z.number().int(),
  scorerId: Id,
  value: z.number(),
  passed: z.boolean(),
  detail: z.record(z.unknown()).default({}),
})
export type EvalResultScore = z.infer<typeof EvalResultScore>

/** What the runner POSTs back to the server (may be chunked across calls). */
export const EvalResult = z.object({
  runId: Id,
  cells: z.array(EvalResultCell),
  scores: z.array(EvalResultScore),
  summary: z
    .object({
      total: z.number().int(),
      passed: z.number().int(),
      failed: z.number().int(),
      errored: z.number().int(),
      score: z.number().nullable(),
      durationMs: z.number().int().nullable(),
    })
    .optional(),
})
export type EvalResult = z.infer<typeof EvalResult>
