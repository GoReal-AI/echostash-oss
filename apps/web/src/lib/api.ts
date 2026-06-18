import type { Message, ModelParams } from '@echostash/shared'

export type Resolution = 'resolved' | 'partial' | 'dynamic'

export interface PromptListItem {
  id: string
  name: string
  fingerprint: string
  lastSeenAt: string
  snapshotCount: number
  model: string | null
  provider: string | null
  resolution: Resolution | null
  filePath: string | null
}

export interface Snapshot {
  id: string
  contentHash: string
  configHash: string
  messages: Message[]
  params: ModelParams
  provider: string | null
  model: string | null
  resolution: Resolution
  filePath: string | null
  symbol: string | null
  gitSha: string | null
  gitRef: string | null
  firstSeenAt: string
  lastSeenAt: string
  seenCount: number
}

export interface PromptDetail {
  prompt: {
    id: string
    name: string
    fingerprint: string
    type: string
    firstSeenAt: string
    lastSeenAt: string
  }
  snapshots: Snapshot[]
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

export const fetchPrompts = () => getJson<PromptListItem[]>('/api/prompts')
export const fetchPrompt = (id: string) => getJson<PromptDetail>(`/api/prompts/${id}`)
