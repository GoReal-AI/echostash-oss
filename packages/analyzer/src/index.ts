import type { DiscoveredPrompt } from '@echostash/shared'

export interface ScanOptions {
  /** Absolute path to the repo / directory to scan. */
  root: string
  /** Glob(s) of files to include. Defaults to TS/JS sources. */
  include?: string[]
  /** Glob(s) to exclude (node_modules, dist, tests, ...). */
  exclude?: string[]
}

/**
 * Walk source files, find LLM call sites, and resolve the prompt content,
 * model, and params at each one.
 *
 * MILESTONE M2 — not yet implemented. The contract is fixed: return one
 * `DiscoveredPrompt` per call site. Implementation plan:
 *   1. Parse TS/JS with the TypeScript compiler API.
 *   2. Match known LLM call shapes (openai/anthropic/google/vertex/vercel-ai/
 *      langchain/litellm) — see docs/ROADMAP.md "M2".
 *   3. Read off model + params from the call's options object.
 *   4. Resolve the messages/prompt argument: literal -> resolved; const/import
 *      -> follow binding; fs.readFile/import of a file -> follow to file;
 *      runtime-assembled -> skeleton with `{{holes}}`, resolution='partial'/'dynamic'.
 *   5. Fingerprint = `${relPath}:${enclosingSymbol}` (+ structural disambiguator).
 */
export async function scan(_options: ScanOptions): Promise<DiscoveredPrompt[]> {
  throw new Error('Analyzer not implemented yet — see packages/analyzer (milestone M2).')
}

export const ANALYZER_MILESTONE = 'M2' as const
