import { type CompleteArgs, type Completion, complete as defaultComplete } from '@echostash/llm'
import { evaluate } from '@echostash/scoring'
import type {
  DatasetCase,
  EvalJobSpec,
  EvalResult,
  EvalResultCell,
  EvalResultScore,
  Variant,
} from '@echostash/shared'
import { costUsd, isPriced } from './cost'

export { costUsd, isPriced } from './cost'

/** The LLM call, injectable so the executor can be unit-tested without a network/keys. */
export type CompleteFn = (args: CompleteArgs) => Promise<Completion>

export interface RunEvalOptions {
  /** Max concurrent LLM requests (default 4). */
  concurrency?: number
  /** Override the LLM call — defaults to `@echostash/llm` `complete()`. */
  complete?: CompleteFn
  /** Model spec for `llm_judge` scorers, e.g. `openai:gpt-4o`. Falls back to the `judge` role. */
  judgeSpec?: string
  /** Retries on transient (429 / 5xx / network) errors, per cell (default 2). */
  retries?: number
  /** Progress callback as cells complete. */
  onProgress?: (done: number, total: number) => void
  /** Warn sink for unpriced models etc. (default `console.warn`). */
  onWarn?: (msg: string) => void
}

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

/** Flatten a message's content to text (the runner is text-based; non-text blocks are dropped). */
function toText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((p) => (typeof p === 'string' ? p : ((p as { text?: string }).text ?? '')))
      .join('')
  }
  return ''
}

/** Replace `{{ key }}` holes in a string from the case input. */
function interpolate(text: string, input: Record<string, unknown>): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const v = input[key]
    return v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v)
  })
}

/**
 * Render the messages a variant sends for a case: interpolate the template, then append any mocked
 * prior turns the case carries.
 */
function renderMessages(variant: Variant, c: DatasetCase): ChatMessage[] {
  const base = variant.messages.map((m) => ({
    role: m.role as ChatMessage['role'],
    content: interpolate(toText(m.content), c.input),
  }))
  const extra = (c.messages ?? []).map((m) => ({
    role: m.role as ChatMessage['role'],
    content: toText(m.content),
  }))
  return [...base, ...extra]
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

function isTransient(err: unknown): boolean {
  const e = err as { statusCode?: number; status?: number }
  const status = e.statusCode ?? e.status
  if (status === undefined) return true // network/unknown → worth a retry
  return status === 429 || status >= 500
}

async function withRetry<T>(fn: () => Promise<T>, retries: number): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt >= retries || !isTransient(err)) throw err
      await delay(Math.min(1000 * 2 ** attempt, 15000))
    }
  }
}

/** Run `fn` over `items` with at most `limit` in flight; preserves order. */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (true) {
      const i = next++
      if (i >= items.length) return
      results[i] = await fn(items[i] as T, i)
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker))
  return results
}

interface Job {
  variant: Variant
  case: DatasetCase
  sampleNo: number
}

/**
 * Execute an eval job: run every (variant × case × sample) cell against its model, score each cell
 * with `@echostash/scoring`, and return the matrix + aggregate summary. Pure — the worker/CLI is
 * responsible for posting the result back to the server.
 */
export async function runEval(spec: EvalJobSpec, opts: RunEvalOptions = {}): Promise<EvalResult> {
  const call = opts.complete ?? defaultComplete
  const warn = opts.onWarn ?? ((m: string) => console.warn(m))
  const retries = opts.retries ?? 2
  const allowed = new Set(spec.allowedProviders)
  const startedAt = Date.now()

  // `judge` is built once; only invoked for llm_judge scorers.
  const judge = async (prompt: string): Promise<string> => {
    const args: CompleteArgs = opts.judgeSpec
      ? { spec: opts.judgeSpec, prompt }
      : { role: 'judge', prompt }
    return (await call(args)).text
  }

  // An empty allow-list means "no provider restriction".
  const variants = allowed.size
    ? spec.variants.filter((v) => allowed.has(v.provider))
    : spec.variants
  const skipped = spec.variants.length - variants.length
  if (skipped > 0) warn(`runEval: skipped ${skipped} variant(s) whose provider isn't allowed`)

  const jobs: Job[] = []
  for (const variant of variants) {
    for (const c of spec.cases) {
      for (let s = 0; s < spec.sampleCount; s++) jobs.push({ variant, case: c, sampleNo: s })
    }
  }

  const cells: EvalResultCell[] = []
  const scores: EvalResultScore[] = []
  const unpriced = new Set<string>()
  let done = 0

  await mapPool(jobs, opts.concurrency ?? 4, async ({ variant, case: c, sampleNo }) => {
    let cell: EvalResultCell
    let scored: EvalResultScore[]
    try {
      const out = await withRetry(
        () =>
          call({
            spec: `${variant.provider}:${variant.model}`,
            messages: renderMessages(variant, c),
            temperature: variant.params.temperature,
            maxTokens: variant.params.maxTokens,
          }),
        retries,
      )
      if (!isPriced(variant.model)) unpriced.add(variant.model)
      const cost = costUsd(variant.model, out.usage)
      cell = {
        variantId: variant.id,
        caseId: c.id,
        sampleNo,
        outputText: out.text,
        promptTokens: out.usage.promptTokens,
        completionTokens: out.usage.completionTokens,
        totalTokens: out.usage.totalTokens,
        costUsd: cost,
        latencyMs: out.latencyMs,
        cached: false,
      }
      scored = await Promise.all(
        spec.scorers.map(async (scorer): Promise<EvalResultScore> => {
          const r = await evaluate(
            scorer,
            {
              output: out.text,
              expected: c.expected ?? undefined,
              metrics: {
                latencyMs: out.latencyMs,
                totalTokens: out.usage.totalTokens,
                costUsd: cost ?? undefined,
              },
            },
            { judge },
          )
          return {
            variantId: variant.id,
            caseId: c.id,
            sampleNo,
            scorerId: scorer.id,
            value: r.score,
            passed: r.status === 'pass',
            detail: { status: r.status, ...(r.reason ? { reason: r.reason } : {}) },
          }
        }),
      )
    } catch (err) {
      // The model call failed after retries — keep the matrix rectangular with an errored cell.
      const reason = err instanceof Error ? err.message : String(err)
      cell = {
        variantId: variant.id,
        caseId: c.id,
        sampleNo,
        outputText: '',
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
        costUsd: null,
        latencyMs: null,
        cached: false,
      }
      scored = spec.scorers.map((scorer) => ({
        variantId: variant.id,
        caseId: c.id,
        sampleNo,
        scorerId: scorer.id,
        value: 0,
        passed: false,
        detail: { status: 'error', reason },
      }))
    }

    cells.push(cell)
    scores.push(...scored)
    opts.onProgress?.(++done, jobs.length)
  })

  if (unpriced.size) {
    warn(`runEval: no price table for model(s): ${[...unpriced].join(', ')} — costUsd = null`)
  }

  const weightOf = new Map(spec.scorers.map((s) => [s.id, s.weight]))
  let passed = 0
  let failed = 0
  let errored = 0
  let weightedSum = 0
  let weightTotal = 0
  for (const s of scores) {
    if ((s.detail as { status?: string }).status === 'error') {
      errored++
      continue
    }
    if (s.passed) passed++
    else failed++
    const w = weightOf.get(s.scorerId) ?? 1
    weightedSum += s.value * w
    weightTotal += w
  }

  return {
    runId: spec.runId,
    cells,
    scores,
    summary: {
      total: scores.length,
      passed,
      failed,
      errored,
      score: weightTotal > 0 ? weightedSum / weightTotal : null,
      durationMs: Date.now() - startedAt,
    },
  }
}
