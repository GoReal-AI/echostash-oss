import { generateText } from 'ai'
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
  const model = getLanguageModel(specFrom(args))
  const { text } = await generateText({
    model,
    system: args.system,
    prompt: args.prompt,
    temperature: args.temperature ?? 0,
    maxTokens: args.maxTokens,
  })
  return text
}
