import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createVertex } from '@ai-sdk/google-vertex'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'

/** Each *purpose* is a role the user configures independently. */
export type ModelRole = 'scan' | 'judge' | 'embedding' | 'sandbox'

export interface ModelSpec {
  /** openai | anthropic | google | vertex | litellm */
  provider: string
  model: string
}

/** Parse a "<provider>:<model>" spec (the model is whatever the user configures). */
export function parseSpec(spec: string): ModelSpec {
  const idx = spec.indexOf(':')
  if (idx === -1) throw new Error(`invalid model spec "${spec}" — expected "provider:model"`)
  return { provider: spec.slice(0, idx).trim(), model: spec.slice(idx + 1).trim() }
}

/**
 * Resolve a role to a spec from the environment, e.g. ECHOSTASH_SCAN_MODEL.
 * Returns null when unset so callers can fall back / report clearly.
 */
export function resolveRole(role: ModelRole, env = process.env): ModelSpec | null {
  const raw = env[`ECHOSTASH_${role.toUpperCase()}_MODEL`]
  return raw ? parseSpec(raw) : null
}

/** Build a Vercel AI SDK language model for a spec. Provider-agnostic. */
export function getLanguageModel(spec: ModelSpec, env = process.env): LanguageModel {
  switch (spec.provider) {
    case 'openai':
      return createOpenAI({ apiKey: env.OPENAI_API_KEY })(spec.model)
    case 'anthropic':
      return createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })(spec.model)
    case 'google':
      return createGoogleGenerativeAI({
        apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY ?? env.GOOGLE_API_KEY,
      })(spec.model)
    case 'vertex': {
      const project = env.GOOGLE_VERTEX_PROJECT ?? env.GOOGLE_CLOUD_PROJECT ?? env.GCLOUD_PROJECT
      const location = env.GOOGLE_VERTEX_LOCATION ?? 'us-central1'
      if (!project)
        throw new Error('vertex provider needs GOOGLE_VERTEX_PROJECT (or GOOGLE_CLOUD_PROJECT)')
      // credentials come from Application Default Credentials (gcloud / GOOGLE_APPLICATION_CREDENTIALS)
      return createVertex({ project, location })(spec.model)
    }
    case 'litellm':
    case 'openai-compatible': {
      const baseURL = env.LITELLM_BASE_URL
      if (!baseURL) throw new Error('litellm provider needs LITELLM_BASE_URL')
      return createOpenAI({ baseURL, apiKey: env.LITELLM_API_KEY })(spec.model)
    }
    default:
      throw new Error(`unknown provider "${spec.provider}"`)
  }
}
