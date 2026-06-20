import { type ToolSet, generateObject, generateText } from 'ai'
import type { z } from 'zod'
import { type ModelRole, type ModelSpec, getLanguageModel, parseSpec, resolveRole } from './models'

export * from './models'

/** Resolve a role/spec to a Vercel AI SDK model instance. */
export function getModel(opts: { role?: ModelRole; spec?: string }) {
  return getLanguageModel(specFrom(opts))
}

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

export interface AgentArgs {
  role?: ModelRole
  spec?: string
  system?: string
  prompt: string
  tools: ToolSet
  maxSteps?: number
}

/** Run a multi-step tool-using agent (the model drives; tools execute locally). */
export async function runAgent(args: AgentArgs) {
  return generateText({
    model: getLanguageModel(specFrom(args)),
    system: args.system,
    prompt: args.prompt,
    tools: args.tools,
    maxSteps: args.maxSteps ?? 24,
    temperature: 0,
  })
}

/** Structured generation against a zod schema (validated by the SDK). */
export async function generateStructured<T>(
  args: GenerateArgs & { schema: z.ZodType<T> },
): Promise<T> {
  const model = getLanguageModel(specFrom(args))
  const { object } = await generateObject({
    model,
    schema: args.schema,
    system: args.system,
    prompt: args.prompt,
    temperature: args.temperature ?? 0,
    maxTokens: args.maxTokens,
  })
  return object
}
