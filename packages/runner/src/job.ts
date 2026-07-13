import type { EvalResult } from '@echostash/shared'
import type { ServerClient } from './client'
import { type CompleteFn, runEval } from './index'

export interface ProcessJobDeps {
  client: ServerClient
  /** Override the LLM call (tests inject a fake); defaults to `@echostash/llm`. */
  complete?: CompleteFn
  /** Model spec for `llm_judge` scorers. */
  judgeSpec?: string
  /** Max concurrent LLM requests in the matrix. */
  concurrency?: number
}

/**
 * Process one eval job: mark it running, fetch the spec, execute the matrix, post results back.
 * On failure it reports `error` status (with the reason) and rethrows so the queue can record it.
 * The whole thing is dependency-injected, so it's unit-testable without Redis or a live server.
 */
export async function processEvalJob(deps: ProcessJobDeps, evalRunId: string): Promise<EvalResult> {
  await deps.client.postStatus(evalRunId, 'running')
  try {
    const spec = await deps.client.getSpec(evalRunId)
    const result = await runEval(spec, {
      complete: deps.complete,
      judgeSpec: deps.judgeSpec,
      concurrency: deps.concurrency,
    })
    await deps.client.postResults(evalRunId, result)
    return result
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    await deps.client.postStatus(evalRunId, 'error', reason).catch(() => {})
    throw err
  }
}
