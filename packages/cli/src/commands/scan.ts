import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
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

const gitLines = (args: string[], cwd: string): string[] =>
  (git(args, cwd) ?? '').split('\n').filter(Boolean)

function fileEntryFrom(root: string, relPath: string, prompts: DiscoveredPrompt[]): FileEntry {
  let fileHash = ''
  try {
    fileHash = sha256(readFileSync(join(root, relPath)))
  } catch {
    // unreadable
  }
  return {
    relPath,
    fileHash,
    prompts: prompts.map((p) => ({
      name: p.name,
      promptHash: promptHashOf(p),
      line: p.line,
      model: p.model,
    })),
  }
}

/**
 * Agentic discovery + change-tracking. Incremental on a git repo: only files changed since the
 * last scan are sent to the agent; the rest carry forward from the manifest.
 */
async function runAgentTrack(
  root: string,
  source: string,
  spec: string | undefined,
): Promise<void> {
  const store = new LocalStore(join(root, '.echostash'))
  const prev = await store.load(source)
  const headSha = git(['rev-parse', 'HEAD'], root)

  let scope: string[] | undefined
  if (prev?.gitSha && headSha) {
    const changed = new Set<string>(
      [
        ...gitLines(['diff', '--name-only', prev.gitSha, headSha], root),
        ...gitLines(['ls-files', '--others', '--exclude-standard'], root),
      ].filter((f) => !f.startsWith('.echostash/')), // our own manifest must not trigger a re-scan
    )
    if (changed.size === 0) {
      console.log(`\nNo changes since ${prev.gitSha.slice(0, 8)} — nothing to re-scan.`)
      await recordChangeset(
        store,
        source,
        prev,
        { ...prev, gitSha: headSha },
        Object.keys(prev.files).length,
      )
      return
    }
    scope = [...changed].filter((f) => existsSync(join(root, f)))
  }

  console.log(
    `Agentic scan of ${root} with ${spec ?? process.env.ECHOSTASH_SCAN_MODEL}` +
      `${scope ? ` (incremental: ${scope.length} changed file(s))` : ''}…`,
  )
  const { locations, steps } = await discover({ root, spec, scopeFiles: scope })
  const fresh = extractLocations(root, locations)
  console.log(`  agent: ${steps} step(s), ${locations.length} location(s) reported`)

  const freshByFile = new Map<string, DiscoveredPrompt[]>()
  for (const p of fresh) {
    const list = freshByFile.get(p.filePath) ?? []
    list.push(p)
    freshByFile.set(p.filePath, list)
  }

  let files: Record<string, FileEntry>
  if (scope) {
    files = { ...(prev?.files ?? {}) }
    for (const f of scope) {
      const ps = freshByFile.get(f)
      if (ps?.length) files[f] = fileEntryFrom(root, f, ps)
      else delete files[f] // changed file no longer holds a prompt
    }
    for (const f of gitLines(
      ['diff', '--name-only', '--diff-filter=D', prev?.gitSha ?? '', headSha ?? ''],
      root,
    )) {
      delete files[f] // deleted on disk
    }
  } else {
    files = {}
    for (const [f, ps] of freshByFile) files[f] = fileEntryFrom(root, f, ps)
  }

  const manifest: Manifest = { source, gitSha: headSha, files }
  const skipped = scope
    ? Object.keys(prev?.files ?? {}).filter((f) => !scope?.includes(f)).length
    : 0
  const total = Object.values(files).reduce((n, fe) => n + fe.prompts.length, 0)
  console.log(`\n${total} prompt(s) tracked.`)
  await recordChangeset(store, source, prev, manifest, skipped)
}

export async function runScan(argv: string[]): Promise<number> {
  const flags = parseFlags(argv)
  const root = resolve(flags.positional[0] ?? '.')
  const server = flags.server ?? process.env.ECHOSTASH_URL ?? 'http://localhost:8080'
  const apiKey = flags.apiKey ?? process.env.ECHOSTASH_API_KEY

  const modelConfigured = flags.scanModel ?? process.env.ECHOSTASH_SCAN_MODEL
  const useLlm = !flags.noLlm && Boolean(modelConfigured)
  const classifier = useLlm ? makeClassifier(flags.scanModel) : undefined

  if (flags.agent && !modelConfigured) {
    console.error('--agent needs a scan model (--scan-model or ECHOSTASH_SCAN_MODEL).')
    return 1
  }
  // The complete flow: agentic discovery + incremental change-tracking.
  if (flags.agent && flags.track) {
    await runAgentTrack(root, flags.source ?? basename(root), flags.scanModel)
    return 0
  }

  let prompts: DiscoveredPrompt[]
  if (flags.agent) {
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
