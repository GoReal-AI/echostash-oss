import { z } from 'zod'
import { Id, Provider, Resolution, SourceKind, Timestamp } from './common'

/** A single block of prompt content. Mirrors multimodal message parts. */
export const ContentBlock = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }),
  z.object({ type: z.literal('image_url'), url: z.string() }),
  z.object({
    type: z.literal('tool_call'),
    name: z.string(),
    arguments: z.record(z.unknown()).default({}),
  }),
])
export type ContentBlock = z.infer<typeof ContentBlock>

export const Role = z.enum(['system', 'user', 'assistant', 'tool'])
export type Role = z.infer<typeof Role>

/** A chat message: either a plain string or an array of content blocks. */
export const Message = z.object({
  role: Role,
  content: z.union([z.string(), z.array(ContentBlock)]),
})
export type Message = z.infer<typeof Message>

/** Tunable model parameters captured at a call site. */
export const ModelParams = z
  .object({
    temperature: z.number().optional(),
    topP: z.number().optional(),
    topK: z.number().optional(),
    maxTokens: z.number().int().optional(),
    seed: z.number().int().optional(),
    stop: z.union([z.string(), z.array(z.string())]).optional(),
    presencePenalty: z.number().optional(),
    frequencyPenalty: z.number().optional(),
  })
  .passthrough()
export type ModelParams = z.infer<typeof ModelParams>

/** A prompt identity — stable across content edits via its call-site fingerprint. */
export const Prompt = z.object({
  id: Id,
  /** call-site fingerprint: file + enclosing symbol + structure */
  fingerprint: z.string(),
  /** human name, auto-derived from the enclosing symbol, renamable in the UI */
  name: z.string(),
  projectId: Id.nullable(),
  /** `tool` = an MCP tool definition: its name + description + inputSchema are the prompt. */
  type: z.enum(['prompt', 'skill', 'tool']).default('prompt'),
  firstSeenAt: Timestamp,
  lastSeenAt: Timestamp,
})
export type Prompt = z.infer<typeof Prompt>

/**
 * An observed version of a prompt. Append-only.
 * `contentHash` identifies the prompt text; `configHash` identifies model+params.
 * Either changing produces a new snapshot — that's how we flag "the model changed".
 */
export const PromptSnapshot = z.object({
  id: Id,
  promptId: Id,
  contentHash: z.string(),
  configHash: z.string(),
  content: z.array(ContentBlock).default([]),
  messages: z.array(Message).default([]),
  provider: Provider.nullable(),
  model: z.string().nullable(),
  params: ModelParams.default({}),
  resolution: Resolution,
  sourceId: Id,
  gitSha: z.string().nullable(),
  gitRef: z.string().nullable(),
  filePath: z.string().nullable(),
  symbol: z.string().nullable(),
  firstSeenAt: Timestamp,
  lastSeenAt: Timestamp,
  seenCount: z.number().int().default(1),
})
export type PromptSnapshot = z.infer<typeof PromptSnapshot>

export const Source = z.object({
  id: Id,
  kind: SourceKind,
  name: z.string(),
  config: z.record(z.unknown()).default({}),
  lastSyncAt: Timestamp.nullable(),
  createdAt: Timestamp,
})
export type Source = z.infer<typeof Source>
