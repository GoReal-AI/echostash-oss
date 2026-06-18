// Sample data that drives the UI skeleton so every screen tells one coherent
// story. Real screens get wired to the API per-milestone (prompts/versions
// already have live endpoints — see lib/api.ts).

export type Resolution = 'resolved' | 'partial' | 'dynamic'
export type EvalState = 'pass' | 'fail' | 'none'
export type ChangeKind = 'first' | 'content' | 'model' | 'reobserved'

export interface Project {
  id: string
  name: string
  slug: string
  repo: string
  promptCount: number
  lastScan: string
  defaultBranch: string
}

export interface Prompt {
  id: string
  projectId: string
  name: string
  fingerprint: string
  file: string
  line: number
  provider: string
  model: string
  resolution: Resolution
  versions: number
  evalState: EvalState
  evalScore: number | null
  lastChanged: string
  calls7d: number
}

export interface Version {
  id: string
  v: number
  provider: string
  model: string
  params: Record<string, number | string>
  resolution: Resolution
  change: ChangeKind
  gitSha: string
  gitRef: string
  author: string
  date: string
  contentHash: string
  configHash: string
  messages: { role: string; content: string }[]
}

export interface Dataset {
  id: string
  projectId: string
  promptId: string | null
  name: string
  slug: string
  caseCount: number
  description: string
}

export interface DatasetCase {
  id: string
  name: string
  input: Record<string, string>
  expected: string | null
}

export interface Scorer {
  id: string
  name: string
  type: 'deterministic' | 'llm_judge' | 'semantic'
}

export interface EvalVariant {
  name: string
  provider: string
  model: string
  params: string
  score: number
  baseline?: boolean
}

export interface EvalRun {
  id: string
  promptId: string
  promptName: string
  datasetName: string
  caseCount: number
  status: 'done' | 'running' | 'error'
  score: number
  delta: number | null
  trigger: 'sandbox' | 'manual' | 'ci'
  createdAt: string
  variants: EvalVariant[]
}

export interface Trace {
  id: string
  promptName: string
  provider: string
  model: string
  latencyMs: number
  tokens: number
  costUsd: number
  status: 'ok' | 'error'
  time: string
}

export const projects: Project[] = [
  {
    id: 'prj_support',
    name: 'Support Bot',
    slug: 'support-bot',
    repo: 'acme/support-bot',
    promptCount: 4,
    lastScan: '2h ago',
    defaultBranch: 'main',
  },
  {
    id: 'prj_rag',
    name: 'Docs RAG',
    slug: 'docs-rag',
    repo: 'acme/docs-rag',
    promptCount: 2,
    lastScan: '1d ago',
    defaultBranch: 'main',
  },
]

export const prompts: Prompt[] = [
  {
    id: 'pmt_summarize',
    projectId: 'prj_support',
    name: 'summarize',
    fingerprint: 'api/chat.ts:summarize',
    file: 'api/chat.ts',
    line: 14,
    provider: 'openai',
    model: 'gpt-4o',
    resolution: 'resolved',
    versions: 3,
    evalState: 'pass',
    evalScore: 92,
    lastChanged: '2h ago',
    calls7d: 1820,
  },
  {
    id: 'pmt_classify',
    projectId: 'prj_support',
    name: 'classifyIntent',
    fingerprint: 'api/intent.ts:classifyIntent',
    file: 'api/intent.ts',
    line: 8,
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    resolution: 'partial',
    versions: 1,
    evalState: 'fail',
    evalScore: 71,
    lastChanged: '1d ago',
    calls7d: 5400,
  },
  {
    id: 'pmt_reply',
    projectId: 'prj_support',
    name: 'draftReply',
    fingerprint: 'api/reply.ts:draftReply',
    file: 'api/reply.ts',
    line: 22,
    provider: 'openai',
    model: 'gpt-4o-mini',
    resolution: 'partial',
    versions: 2,
    evalState: 'pass',
    evalScore: 88,
    lastChanged: '3d ago',
    calls7d: 940,
  },
  {
    id: 'pmt_escalate',
    projectId: 'prj_support',
    name: 'shouldEscalate',
    fingerprint: 'api/triage.ts:shouldEscalate',
    file: 'api/triage.ts',
    line: 51,
    provider: 'openai',
    model: 'gpt-4o-mini',
    resolution: 'resolved',
    versions: 1,
    evalState: 'none',
    evalScore: null,
    lastChanged: '5d ago',
    calls7d: 210,
  },
  {
    id: 'pmt_raganswer',
    projectId: 'prj_rag',
    name: 'ragAnswer',
    fingerprint: 'rag/answer.ts:ragAnswer',
    file: 'rag/answer.ts',
    line: 31,
    provider: 'openai',
    model: 'gpt-4o',
    resolution: 'dynamic',
    versions: 5,
    evalState: 'fail',
    evalScore: 64,
    lastChanged: '6h ago',
    calls7d: 7300,
  },
  {
    id: 'pmt_rerank',
    projectId: 'prj_rag',
    name: 'rerankChunks',
    fingerprint: 'rag/rerank.ts:rerankChunks',
    file: 'rag/rerank.ts',
    line: 12,
    provider: 'google',
    model: 'gemini-2.0-flash',
    resolution: 'resolved',
    versions: 2,
    evalState: 'pass',
    evalScore: 95,
    lastChanged: '2d ago',
    calls7d: 12400,
  },
]

const summarizeVersions: Version[] = [
  {
    id: 'v_s3',
    v: 3,
    provider: 'openai',
    model: 'gpt-4o',
    params: { temperature: 0.2, max_tokens: 500 },
    resolution: 'resolved',
    change: 'model',
    gitSha: 'a3f9c12',
    gitRef: 'main',
    author: 'dana',
    date: '2h ago',
    contentHash: '7e6d815f',
    configHash: 'f3074fe7',
    messages: [
      { role: 'system', content: 'You are a terse summarizer.' },
      { role: 'user', content: 'Summarize: {{text}}' },
    ],
  },
  {
    id: 'v_s2',
    v: 2,
    provider: 'openai',
    model: 'gpt-4o-mini',
    params: { temperature: 0.2 },
    resolution: 'resolved',
    change: 'content',
    gitSha: '7b21e09',
    gitRef: 'main',
    author: 'yoad',
    date: '1d ago',
    contentHash: '7e6d815f',
    configHash: '11df6510',
    messages: [
      { role: 'system', content: 'You are a terse summarizer.' },
      { role: 'user', content: 'Summarize: {{text}}' },
    ],
  },
  {
    id: 'v_s1',
    v: 1,
    provider: 'openai',
    model: 'gpt-4o-mini',
    params: { temperature: 0.7 },
    resolution: 'resolved',
    change: 'first',
    gitSha: '41ee0aa',
    gitRef: 'main',
    author: 'yoad',
    date: '6d ago',
    contentHash: 'c9a1b2d3',
    configHash: '88aa1199',
    messages: [
      { role: 'system', content: 'Summarize the user text briefly.' },
      { role: 'user', content: '{{text}}' },
    ],
  },
]

export const versionsByPrompt: Record<string, Version[]> = {
  pmt_summarize: summarizeVersions,
}

export const datasets: Dataset[] = [
  {
    id: 'ds_support',
    projectId: 'prj_support',
    promptId: 'pmt_summarize',
    name: 'support-cases',
    slug: 'support-cases',
    caseCount: 20,
    description: 'Real support tickets curated into a golden set.',
  },
  {
    id: 'ds_edge',
    projectId: 'prj_support',
    promptId: 'pmt_summarize',
    name: 'edge-cases',
    slug: 'edge-cases',
    caseCount: 8,
    description: 'Tricky / adversarial inputs.',
  },
  {
    id: 'ds_rag',
    projectId: 'prj_rag',
    promptId: 'pmt_raganswer',
    name: 'rag-qa',
    slug: 'rag-qa',
    caseCount: 35,
    description: 'Question/answer pairs over the docs corpus.',
  },
]

export const datasetCases: DatasetCase[] = [
  {
    id: 'c1',
    name: 'refund request',
    input: { text: 'I want a refund for order #4821…' },
    expected: 'mentions refund + order id',
  },
  {
    id: 'c2',
    name: 'greeting',
    input: { text: 'hi there, are you open?' },
    expected: 'short, friendly',
  },
  {
    id: 'c3',
    name: 'angry customer',
    input: { text: 'THIS IS THE THIRD TIME…' },
    expected: 'calm, empathetic',
  },
  { id: 'c4', name: 'empty-ish', input: { text: '...' }, expected: null },
]

export const scorers: Scorer[] = [
  { id: 'sc1', name: 'contains order id', type: 'deterministic' },
  { id: 'sc2', name: 'tone is empathetic', type: 'llm_judge' },
  { id: 'sc3', name: 'similar to expected', type: 'semantic' },
]

export const evalRuns: EvalRun[] = [
  {
    id: 'run_3',
    promptId: 'pmt_summarize',
    promptName: 'summarize',
    datasetName: 'support-cases',
    caseCount: 20,
    status: 'done',
    score: 92,
    delta: 4,
    trigger: 'ci',
    createdAt: '2h ago',
    variants: [
      { name: 'A', provider: 'openai', model: 'gpt-4o', params: 't0.2', score: 92, baseline: true },
      { name: 'B', provider: 'openai', model: 'gpt-4o-mini', params: 't0.2', score: 88 },
      { name: 'C', provider: 'anthropic', model: 'claude-sonnet-4-6', params: 't0.4', score: 90 },
    ],
  },
  {
    id: 'run_2',
    promptId: 'pmt_summarize',
    promptName: 'summarize',
    datasetName: 'support-cases',
    caseCount: 20,
    status: 'done',
    score: 88,
    delta: -1,
    trigger: 'manual',
    createdAt: '1d ago',
    variants: [
      {
        name: 'A',
        provider: 'openai',
        model: 'gpt-4o-mini',
        params: 't0.2',
        score: 88,
        baseline: true,
      },
    ],
  },
  {
    id: 'run_1',
    promptId: 'pmt_raganswer',
    promptName: 'ragAnswer',
    datasetName: 'rag-qa',
    caseCount: 35,
    status: 'done',
    score: 64,
    delta: -9,
    trigger: 'ci',
    createdAt: '6h ago',
    variants: [
      { name: 'A', provider: 'openai', model: 'gpt-4o', params: 't0.3', score: 64, baseline: true },
      { name: 'B', provider: 'openai', model: 'gpt-4o', params: 't0.0', score: 71 },
    ],
  },
]

export const evalCases: { name: string; cells: ('pass' | 'fail')[] }[] = [
  { name: 'refund request', cells: ['pass', 'pass', 'pass'] },
  { name: 'greeting', cells: ['pass', 'pass', 'fail'] },
  { name: 'angry customer', cells: ['pass', 'fail', 'pass'] },
  { name: 'edge-1', cells: ['fail', 'fail', 'pass'] },
  { name: 'multi-turn', cells: ['pass', 'pass', 'pass'] },
]

export const traces: Trace[] = [
  {
    id: 't1',
    promptName: 'rerankChunks',
    provider: 'google',
    model: 'gemini-2.0-flash',
    latencyMs: 240,
    tokens: 320,
    costUsd: 0.0002,
    status: 'ok',
    time: '12s ago',
  },
  {
    id: 't2',
    promptName: 'ragAnswer',
    provider: 'openai',
    model: 'gpt-4o',
    latencyMs: 1840,
    tokens: 1450,
    costUsd: 0.0121,
    status: 'ok',
    time: '20s ago',
  },
  {
    id: 't3',
    promptName: 'classifyIntent',
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    latencyMs: 610,
    tokens: 240,
    costUsd: 0.0014,
    status: 'ok',
    time: '34s ago',
  },
  {
    id: 't4',
    promptName: 'ragAnswer',
    provider: 'openai',
    model: 'gpt-4o',
    latencyMs: 5200,
    tokens: 2100,
    costUsd: 0.0182,
    status: 'error',
    time: '1m ago',
  },
  {
    id: 't5',
    promptName: 'summarize',
    provider: 'openai',
    model: 'gpt-4o',
    latencyMs: 980,
    tokens: 540,
    costUsd: 0.0046,
    status: 'ok',
    time: '2m ago',
  },
]

export const providers = [
  { id: 'openai', name: 'OpenAI', configured: true, models: ['gpt-4o', 'gpt-4o-mini'] },
  {
    id: 'anthropic',
    name: 'Anthropic',
    configured: true,
    models: ['claude-sonnet-4-6', 'claude-opus-4-8'],
  },
  { id: 'google', name: 'Google', configured: false, models: ['gemini-2.0-flash'] },
  { id: 'vertex', name: 'Vertex', configured: false, models: [] },
  { id: 'litellm', name: 'LiteLLM proxy', configured: false, models: [] },
]

export const apiKeys = [
  { id: 'k1', name: 'CI — support-bot', prefix: 'pf_a1b2', lastUsed: '2h ago' },
  { id: 'k2', name: 'CI — docs-rag', prefix: 'pf_c3d4', lastUsed: '6h ago' },
]

// helpers
export const getProject = (id: string) => projects.find((p) => p.id === id)
export const getPrompt = (id: string) => prompts.find((p) => p.id === id)
export const promptsByProject = (projectId: string) =>
  prompts.filter((p) => p.projectId === projectId)
export const versionsFor = (promptId: string) => versionsByPrompt[promptId] ?? []
export const datasetsFor = (promptId: string) => datasets.filter((d) => d.promptId === promptId)
export const evalRunsFor = (promptId: string) => evalRuns.filter((r) => r.promptId === promptId)
export const getDataset = (id: string) => datasets.find((d) => d.id === id)
export const getEvalRun = (id: string) => evalRuns.find((r) => r.id === id)
