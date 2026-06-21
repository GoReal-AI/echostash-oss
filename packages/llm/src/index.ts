import { type CoreMessage, generateText } from 'ai'
import { type ModelRole, type ModelSpec, getLanguageModel, parseSpec, resolveRole } from './models'

export * from './models'

function specFrom(opts: { role?: ModelRole; spec?: string }): ModelSpec {
  if (opts.spec) return parseSpec(opts.spec)
  if (opts.role) {
    const r = resolveRole(opts.role)
    if (!r)
      throw new Error(
        `no model configured for role "${opts.role}" (set ECHOSTASH_${opts.role.toUpperCase()}_MODEL)`,
      )
    return r
  }
  throw new Error('generate requires a `role` or a `spec`')
}

export interface GenerateArgs {
  role?: ModelRole
  spec?: string
  system?: string
  prompt: string
  temperature?: number
  maxTokens?: number
}

/** Plain text generation. */
export async function generate(args: GenerateArgs): Promise<string> {
  return (await complete(args)).text
}

export interface CompleteArgs {
  role?: ModelRole
  spec?: string
  system?: string
  /** A single user prompt — ignored when `messages` is given. */
  prompt?: string
  /** A full chat (system/user/assistant); takes precedence over `prompt`. */
  messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  temperature?: number
  maxTokens?: number
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface Completion {
  text: string
  usage: TokenUsage
  latencyMs: number
  finishReason: string
}

/** Generation that also reports token usage + latency — what the eval runner needs per cell. */
export async function complete(args: CompleteArgs): Promise<Completion> {
  const model = getLanguageModel(specFrom(args))
  const start = Date.now()
  const res = await generateText({
    model,
    system: args.messages ? undefined : args.system,
    messages: args.messages as CoreMessage[] | undefined,
    prompt: args.messages ? undefined : args.prompt,
    temperature: args.temperature ?? 0,
    maxTokens: args.maxTokens,
  })
  const u = res.usage
  return {
    text: res.text,
    usage: {
      promptTokens: u?.promptTokens ?? 0,
      completionTokens: u?.completionTokens ?? 0,
      totalTokens: u?.totalTokens ?? 0,
    },
    latencyMs: Date.now() - start,
    finishReason: res.finishReason ?? 'unknown',
  }
}
