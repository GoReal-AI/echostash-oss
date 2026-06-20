import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'
import { DEFAULT_EXCLUDE, extractFile, listSourceFiles, scanReport } from '@echostash/analyzer'
import { discover, extractLocations } from '@echostash/discovery'
import {
  type FileEntry,
  LocalStore,
  type Manifest,
  type ScanInputFile,
  type Store,
  buildManifest,
  diffManifests,
  hashValue,
  sha256,
} from '@echostash/scan'
import type { DiscoveredPrompt, ScanReport, ScanReportResult } from '@echostash/shared'
import { makeClassifier } from '../classifier'

const promptHashOf = (p: DiscoveredPrompt) =>
  hashValue({ messages: p.messages, content: p.content })

interface Flags {
  positional: string[]
  server?: string
  apiKey?: string
  source?: string
  scanModel?: string
  noLlm: boolean
  dryRun: boolean
  track: boolean
  agent: boolean
}

function parseFlags(argv: string[]): Flags {
  const f: Flags = { positional: [], noLlm: false, dryRun: false, track: false, agent: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--server') f.server = argv[++i]
    else if (a === '--api-key') f.apiKey = argv[++i]
    else if (a === '--source') f.source = argv[++i]
    else if (a === '--scan-model') f.scanModel = argv[++i]
    else if (a === '--no-llm') f.noLlm = true
    else if (a === '--dry-run') f.dryRun = true
    else if (a === '--track') f.track = true
    else if (a === '--agent') f.agent = true
    else if (a && !a.startsWith('-')) f.positional.push(a)
  }
  return f
}

/** Diff a manifest against the stored one, persist, and print the changeset. */
async function recordChangeset(
  store: Store,
  source: string,
  prev: Manifest | null,
  manifest: Manifest,
  filesSkipped: number,
): Promise<void> {
  const changeset = diffManifests(prev, manifest)
  changeset.filesSkipped = filesSkipped
  await store.save(source, manifest, changeset)

  const s = changeset.summary
  console.log(`\nChange tracking (source "${source}" · .echostash/)`)
  console.log(
    `  ${s.new} new · ${s.modified} modified · ${s.deleted} deleted · ${s.unchanged} unchanged ` +
      `(skipped ${filesSkipped} unchanged file(s))`,
  )
  for (const c of changeset.changes) {
    if (c.status !== 'unchanged') console.log(`    ${c.status.padEnd(9)} ${c.relPath}:${c.name}`)
  }
}

/** Deterministic per-file tracking with skip-by-hash (definite-tier extractor). */
async function trackChanges(root: string, source: string): Promise<void> {
  const store = new LocalStore(join(root, '.echostash'))
  const prev = await store.load(source)
  const files: ScanInputFile[] = listSourceFiles(root, DEFAULT_EXCLUDE).map((abs) => ({
    relPath: relative(root, abs),
    bytes: () => readFileSync(abs),
  }))
  const { manifest, filesSkipped } = await buildManifest({
    source,
    files,
    prev,
    extract: (relPath) =>
      extractFile(join(root, relPath), relPath).map((p) => ({
        name: p.name,
        promptHash: promptHashOf(p),
        line: p.line,
        model: p.model,
      })),
  })
  await recordChangeset(store, source, prev, manifest, filesSkipped)
}

/** Track changes from an already-discovered prompt set (e.g. the agent's output). */
async function trackFromPrompts(
  root: string,
  source: string,
  prompts: DiscoveredPrompt[],
): Promise<void> {
  const store = new LocalStore(join(root, '.echostash'))
  const prev = await store.load(source)
  const byFile = new Map<string, DiscoveredPrompt[]>()
  for (const p of prompts) {
    const list = byFile.get(p.filePath) ?? []
    list.push(p)
    byFile.set(p.filePath, list)
  }
  const files: Record<string, FileEntry> = {}
  for (const [relPath, ps] of byFile) {
    let fileHash = ''
    try {
      fileHash = sha256(readFileSync(join(root, relPath)))
    } catch {
      // file unreadable — leave hash empty
    }
    files[relPath] = {
      relPath,
      fileHash,
      prompts: ps.map((p) => ({
        name: p.name,
        promptHash: promptHashOf(p),
        line: p.line,
        model: p.model,
      })),
    }
  }
  await recordChangeset(store, source, prev, { source, files }, 0)
}

function git(args: string[], cwd: string): string | null {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

export async function runScan(argv: string[]): Promise<number> {
  const flags = parseFlags(argv)
  const root = resolve(flags.positional[0] ?? '.')
  const server = flags.server ?? process.env.ECHOSTASH_URL ?? 'http://localhost:8080'
  const apiKey = flags.apiKey ?? process.env.ECHOSTASH_API_KEY

  const modelConfigured = flags.scanModel ?? process.env.ECHOSTASH_SCAN_MODEL
  const useLlm = !flags.noLlm && Boolean(modelConfigured)
  const classifier = useLlm ? makeClassifier(flags.scanModel) : undefined

  let prompts: DiscoveredPrompt[]
  if (flags.agent) {
    if (!modelConfigured) {
      console.error('--agent needs a scan model (--scan-model or ECHOSTASH_SCAN_MODEL).')
      return 1
    }
    console.log(`Agentic scan of ${root} with ${modelConfigured}…`)
    const { locations, steps } = await discover({ root, spec: flags.scanModel })
    prompts = extractLocations(root, locations)
    console.log(`  agent: ${steps} step(s), ${locations.length} location(s) reported`)
  } else {
    const report = await scanReport({ root, classifier })
    const libs = report.libraries.length ? `  (libs: ${report.libraries.join(', ')})` : ''
    const llmNote = useLlm
      ? `→ ${report.stats.classifiedIn} sent to ${modelConfigured}`
      : '(LLM off)'
    console.log(`Scanned ${report.stats.files} files in ${root}${libs}`)
    console.log(
      `  ${report.stats.definite} definite · ${report.stats.candidates} gray candidate(s) ${llmNote}`,
    )
    prompts = report.prompts
  }

  console.log(`\nFound ${prompts.length} prompt(s):`)
  for (const p of prompts) {
    const model = p.model ? `${p.provider ?? '?'}/${p.model}` : 'no-model'
    console.log(`  • ${p.fingerprint}  [${model}]  (${p.resolution})`)
  }

  if (flags.track) {
    if (flags.agent) await trackFromPrompts(root, flags.source ?? basename(root), prompts)
    else await trackChanges(root, flags.source ?? basename(root))
  }

  if (flags.dryRun) {
    console.log('\n--dry-run: not posting to the server.')
    return 0
  }

  const body: ScanReport = {
    context: {
      sourceName: flags.source ?? basename(root),
      gitSha: git(['rev-parse', 'HEAD'], root),
      gitRef: git(['rev-parse', '--abbrev-ref', 'HEAD'], root),
    },
    prompts,
  }
  const res = await fetch(`${server}/api/ingest/scan`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    console.error(`\nIngest failed: ${res.status} ${await res.text()}`)
    return 1
  }
  const result = (await res.json()) as ScanReportResult
  console.log(
    `\nIngested → ${result.promptsFound} prompt(s), ${result.changesDetected} change(s). (scanRun ${result.scanRunId})`,
  )
  return 0
}
