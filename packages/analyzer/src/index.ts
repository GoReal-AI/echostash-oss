import { basename, extname, relative } from 'node:path'
import type { DiscoveredPrompt } from '@echostash/shared'
import { detectCallSites } from './callsites'
import { type Candidate, collectCandidates } from './candidates'
import { detectLibraries } from './libDetect'
import { DEFAULT_EXCLUDE, listSourceFiles, parseFile } from './walk'

export * from './candidates'
export { detectLibraries } from './libDetect'
export { DEFAULT_EXCLUDE, listSourceFiles, parseFile } from './walk'

/** One gray-zone candidate handed to the model to adjudicate (a preview, never the full string). */
export interface ClassifyItem {
  id: string
  name: string | null
  filePath: string
  line: number
  preview: string
  length: number
}

export interface ClassifyVerdict {
  id: string
  isPrompt: boolean
}

/** Injected by the caller (the CLI wires `@echostash/llm`); keeps the analyzer LLM-agnostic. */
export type Classifier = (items: ClassifyItem[]) => Promise<ClassifyVerdict[]>

export interface ScanOptions {
  root: string
  exclude?: string[]
  /** Adjudicates `candidate`-tier strings. Omit for fully-deterministic (definite-tier only). */
  classifier?: Classifier
  /** Max chars of a candidate sent to the classifier (the full text is kept from the AST). */
  previewChars?: number
}

export interface ScanReport {
  prompts: DiscoveredPrompt[]
  libraries: string[]
  stats: { files: number; definite: number; candidates: number; classifiedIn: number; kept: number }
}

function toPrompt(c: Candidate): DiscoveredPrompt {
  const fp = `${c.filePath}:${c.name ?? c.symbol ?? basename(c.filePath, extname(c.filePath))}`
  return {
    fingerprint: fp,
    name: c.name ?? c.symbol ?? basename(c.filePath, extname(c.filePath)),
    content: [],
    messages: [{ role: c.role, content: c.text }],
    provider: null,
    model: null,
    params: {},
    resolution: c.resolution,
    filePath: c.filePath,
    symbol: c.symbol,
    line: c.line,
  }
}

/**
 * Discover prompts. Deterministic phases (lib detect → candidate gather → call sites)
 * produce a shortlist; the optional classifier only adjudicates `candidate`-tier strings.
 */
export async function scanReport(options: ScanOptions): Promise<ScanReport> {
  const exclude = options.exclude ?? DEFAULT_EXCLUDE
  const previewChars = options.previewChars ?? 300
  const libraries = detectLibraries(options.root) // phase 1
  const files = listSourceFiles(options.root, exclude)

  const callSitePrompts: DiscoveredPrompt[] = []
  const definite: Candidate[] = []
  const gray: Candidate[] = []

  for (const abs of files) {
    const rel = relative(options.root, abs)
    const sf = parseFile(abs, rel)
    if (!sf) continue
    callSitePrompts.push(...detectCallSites(sf, rel)) // phase 3
    for (const c of collectCandidates(sf, rel)) {
      // phase 2
      if (c.tier === 'definite') definite.push(c)
      else gray.push(c)
    }
  }

  // phase 4 — the model only sees gray-zone previews
  let kept = gray
  let classifiedIn = 0
  if (gray.length > 0 && options.classifier) {
    classifiedIn = gray.length
    const items: ClassifyItem[] = gray.map((c, i) => ({
      id: String(i),
      name: c.name,
      filePath: c.filePath,
      line: c.line,
      preview: c.text.slice(0, previewChars),
      length: c.text.length,
    }))
    const verdicts = await options.classifier(items)
    const yes = new Set(verdicts.filter((v) => v.isPrompt).map((v) => v.id))
    kept = gray.filter((_, i) => yes.has(String(i)))
  } else if (!options.classifier) {
    kept = [] // fully deterministic: definite-tier only
  }

  // merge: call sites first (they carry model+params), then candidate-derived, dedup by fingerprint
  const byFp = new Map<string, DiscoveredPrompt>()
  for (const p of callSitePrompts) byFp.set(p.fingerprint, p)
  for (const c of [...definite, ...kept]) {
    const p = toPrompt(c)
    if (!byFp.has(p.fingerprint)) byFp.set(p.fingerprint, p)
  }

  return {
    prompts: [...byFp.values()],
    libraries,
    stats: {
      files: files.length,
      definite: definite.length,
      candidates: gray.length,
      classifiedIn,
      kept: byFp.size,
    },
  }
}

/** Back-compat: just the prompts. */
export async function scan(options: ScanOptions): Promise<DiscoveredPrompt[]> {
  return (await scanReport(options)).prompts
}

/**
 * Deterministic per-file extraction (call sites + definite-tier candidates, no LLM).
 * Used by the change-tracking layer so each file can be (re)extracted in isolation.
 */
export function extractFile(absPath: string, relPath: string): DiscoveredPrompt[] {
  const sf = parseFile(absPath, relPath)
  if (!sf) return []
  const byFp = new Map<string, DiscoveredPrompt>()
  for (const p of detectCallSites(sf, relPath)) byFp.set(p.fingerprint, p)
  for (const c of collectCandidates(sf, relPath)) {
    if (c.tier !== 'definite') continue
    const p = toPrompt(c)
    if (!byFp.has(p.fingerprint)) byFp.set(p.fingerprint, p)
  }
  return [...byFp.values()]
}

export const ANALYZER_MILESTONE = 'M2' as const
