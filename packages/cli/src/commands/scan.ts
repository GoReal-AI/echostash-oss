import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { type CallShape, augmentShapes, discoverPrompts } from '@echostash/discovery'
import {
  type FileEntry,
  LocalStore,
  type Manifest,
  type Store,
  diffManifests,
  hashValue,
  sha256,
} from '@echostash/scan'
import type { DiscoveredPrompt, ScanReport, ScanReportResult } from '@echostash/shared'
import { loadConfig } from '../config'

const log = (m: string) => console.error(m)
const promptHashOf = (p: DiscoveredPrompt) =>
  hashValue({ messages: p.messages, content: p.content })

interface Flags {
  positional: string[]
  server?: string
  apiKey?: string
  source?: string
  scanModel?: string
  track: boolean
  dryRun: boolean
}

function parseFlags(argv: string[]): Flags {
  const f: Flags = { positional: [], track: false, dryRun: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--server') f.server = argv[++i]
    else if (a === '--api-key') f.apiKey = argv[++i]
    else if (a === '--source') f.source = argv[++i]
    else if (a === '--scan-model') f.scanModel = argv[++i]
    else if (a === '--track') f.track = true
    else if (a === '--dry-run') f.dryRun = true
    else if (a && !a.startsWith('-')) f.positional.push(a)
  }
  return f
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

/** Track changes from an already-discovered prompt set (full manifest, fast). */
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
  for (const [relPath, ps] of byFile) files[relPath] = fileEntryFrom(root, relPath, ps)
  await recordChangeset(
    store,
    source,
    prev,
    { source, gitSha: git(['rev-parse', 'HEAD'], root), files },
    0,
  )
}

export async function runScan(argv: string[]): Promise<number> {
  const flags = parseFlags(argv)
  const root = resolve(flags.positional[0] ?? '.')
  const config = loadConfig(root)
  const source = flags.source ?? config?.source ?? config?.project ?? basename(root)
  const server = flags.server ?? process.env.ECHOSTASH_URL ?? config?.url ?? 'http://localhost:8080'
  const apiKey = flags.apiKey ?? process.env.ECHOSTASH_API_KEY ?? config?.apiKey
  const modelConfigured = flags.scanModel ?? process.env.ECHOSTASH_SCAN_MODEL

  console.log(`Scanning ${root}…`)
  // With a model configured, derive custom-wrapper call shapes first (one bounded request);
  // degrade gracefully to the catalog-only scan if it fails.
  let extraShapes: CallShape[] | undefined
  if (modelConfigured) {
    try {
      extraShapes = await augmentShapes(root, { spec: modelConfigured, onLog: log })
    } catch (err) {
      log(`augment skipped (${err instanceof Error ? err.message : err}) — catalog-only`)
    }
  }
  const prompts = discoverPrompts(root, { onLog: log, extraShapes })

  console.log(`\nFound ${prompts.length} prompt(s):`)
  for (const p of prompts) {
    const model = p.model ? `${p.provider ?? '?'}/${p.model}` : 'no-model'
    console.log(`  • ${p.fingerprint}  [${model}]  (${p.resolution})`)
  }

  if (flags.track) await trackFromPrompts(root, source, prompts)

  if (flags.dryRun) {
    console.log('\n--dry-run: not posting to the server.')
    return 0
  }

  const body: ScanReport = {
    context: {
      sourceName: source,
      gitSha: git(['rev-parse', 'HEAD'], root),
      gitRef: git(['rev-parse', '--abbrev-ref', 'HEAD'], root),
    },
    prompts,
  }
  const res = await fetch(
    `${server}/api/ingest/scan`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    },
  )
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
