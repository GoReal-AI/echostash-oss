import { execFileSync } from 'node:child_process'
import { basename, resolve } from 'node:path'
import { scanReport } from '@echostash/analyzer'
import type { ScanReport, ScanReportResult } from '@echostash/shared'
import { makeClassifier } from '../classifier'

interface Flags {
  positional: string[]
  server?: string
  apiKey?: string
  source?: string
  scanModel?: string
  noLlm: boolean
  dryRun: boolean
}

function parseFlags(argv: string[]): Flags {
  const f: Flags = { positional: [], noLlm: false, dryRun: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--server') f.server = argv[++i]
    else if (a === '--api-key') f.apiKey = argv[++i]
    else if (a === '--source') f.source = argv[++i]
    else if (a === '--scan-model') f.scanModel = argv[++i]
    else if (a === '--no-llm') f.noLlm = true
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

export async function runScan(argv: string[]): Promise<number> {
  const flags = parseFlags(argv)
  const root = resolve(flags.positional[0] ?? '.')
  const server = flags.server ?? process.env.ECHOSTASH_URL ?? 'http://localhost:8080'
  const apiKey = flags.apiKey ?? process.env.ECHOSTASH_API_KEY

  const modelConfigured = flags.scanModel ?? process.env.ECHOSTASH_SCAN_MODEL
  const useLlm = !flags.noLlm && Boolean(modelConfigured)
  const classifier = useLlm ? makeClassifier(flags.scanModel) : undefined

  const report = await scanReport({ root, classifier })

  const libs = report.libraries.length ? `  (libs: ${report.libraries.join(', ')})` : ''
  const llmNote = useLlm ? `→ ${report.stats.classifiedIn} sent to ${modelConfigured}` : '(LLM off)'
  console.log(`Scanned ${report.stats.files} files in ${root}${libs}`)
  console.log(
    `  ${report.stats.definite} definite · ${report.stats.candidates} gray candidate(s) ${llmNote}`,
  )
  console.log(`\nFound ${report.prompts.length} prompt(s):`)
  for (const p of report.prompts) {
    const model = p.model ? `${p.provider ?? '?'}/${p.model}` : 'no-model'
    console.log(`  • ${p.fingerprint}  [${model}]  (${p.resolution})`)
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
    prompts: report.prompts,
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
