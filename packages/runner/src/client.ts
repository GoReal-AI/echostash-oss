import type { EvalJobSpec, EvalResult, EvalStatus } from '@echostash/shared'

/** The subset of the control-plane API a runner worker needs. Injectable so the job is testable. */
export interface ServerClient {
  getSpec(runId: string): Promise<EvalJobSpec>
  postResults(runId: string, result: EvalResult): Promise<void>
  postStatus(runId: string, status: EvalStatus, error?: string): Promise<void>
}

/** HTTP client against the Echostash server, authenticated with a project API key. */
export function httpClient(baseUrl: string, apiKey: string): ServerClient {
  const url = baseUrl.replace(/\/$/, '')
  const call = async (method: string, path: string, body?: unknown): Promise<unknown> => {
    const res = await fetch(url + path, {
      method,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text}`)
    return text ? JSON.parse(text) : null
  }
  return {
    getSpec: (runId) => call('GET', `/api/eval-runs/${runId}/spec`) as Promise<EvalJobSpec>,
    postResults: async (runId, result) => {
      await call('POST', `/api/eval-runs/${runId}/results`, result)
    },
    postStatus: async (runId, status, error) => {
      await call('POST', `/api/eval-runs/${runId}/status`, { status, error })
    },
  }
}
