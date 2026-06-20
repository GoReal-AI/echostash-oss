import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** npm package → the LLM framework/provider it implies. */
const KNOWN: Record<string, string> = {
  openai: 'openai',
  '@anthropic-ai/sdk': 'anthropic',
  '@google/generative-ai': 'google',
  '@google-cloud/vertexai': 'vertex',
  ai: 'vercel-ai',
  '@ai-sdk/openai': 'vercel-ai',
  '@ai-sdk/anthropic': 'vercel-ai',
  langchain: 'langchain',
  '@langchain/core': 'langchain',
  '@langchain/langgraph': 'langgraph',
  deepagents: 'deepagents',
  llamaindex: 'llamaindex',
  'cohere-ai': 'cohere',
}

/**
 * Phase 1 — figure out which LLM library a project uses from its manifest.
 * Informational today (drives reporting + call-shape detection); returns [] when
 * nothing is recognized, in which case we fall back to content-based discovery.
 */
export function detectLibraries(root: string): string[] {
  let deps: Record<string, unknown> = {}
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, unknown>
      devDependencies?: Record<string, unknown>
    }
    deps = { ...pkg.dependencies, ...pkg.devDependencies }
  } catch {
    return []
  }
  const found = new Set<string>()
  for (const [pkgName, label] of Object.entries(KNOWN)) {
    if (pkgName in deps) found.add(label)
  }
  return [...found]
}
