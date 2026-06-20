import { z } from 'zod'
import { Id, Provider, Resolution } from './common'
import { ContentBlock, Message, ModelParams } from './prompt'

/**
 * One prompt found at a call site by the scanner. The server upserts these
 * into prompts + prompt_snapshots, deriving content/config hashes.
 */
export const DiscoveredPrompt = z.object({
  fingerprint: z.string(),
  name: z.string(),
  content: z.array(ContentBlock).default([]),
  messages: z.array(Message).default([]),
  provider: Provider.nullable(),
  model: z.string().nullable(),
  params: ModelParams.default({}),
  resolution: Resolution,
  filePath: z.string(),
  symbol: z.string().nullable(),
  /** 1-based line where the call site starts, for the UI deep-link */
  line: z.number().int().nullable(),
})
export type DiscoveredPrompt = z.infer<typeof DiscoveredPrompt>

/** Git context for a scan, gathered by the CLI / GitHub App. */
export const ScanContext = z.object({
  sourceId: Id.optional(),
  sourceName: z.string(),
  gitSha: z.string().nullable(),
  gitRef: z.string().nullable(),
  repoUrl: z.string().nullable().optional(),
})
export type ScanContext = z.infer<typeof ScanContext>

/** POST /api/ingest/scan body. */
export const ScanReport = z.object({
  context: ScanContext,
  prompts: z.array(DiscoveredPrompt),
})
export type ScanReport = z.infer<typeof ScanReport>

export const ScanReportResult = z.object({
  scanRunId: Id,
  promptsFound: z.number().int(),
  changesDetected: z.number().int(),
})
export type ScanReportResult = z.infer<typeof ScanReportResult>
