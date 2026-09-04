import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { analyze } from '@echostash/analyzer'
import {
  type McpTarget,
  diffBaseline,
  fetchToolSurface,
  parseTarget,
  toBaseline,
  verifyPinning,
} from '@echostash/mcp'
import { McpBaseline, McpToolSurface } from '@echostash/shared'
import { renderCheck, renderReport } from './mcp-report'

const log = (m: string) => console.error(m)

interface Flags {
  positional: string[]
  command?: string
  fromFile?: string
  headers: Record<string, string>
  env: Record<string, string>
  inheritEnv: boolean
  dir: string
  json: boolean
  check: boolean
  updateBaseline: boolean
  threshold: number
}

function parseFlags(argv: string[]): Flags {
  const f: Flags = {
    positional: [],
    headers: {},
    env: {},
    inheritEnv: false,
    dir: '.echostash',
    json: false,
    check: false,
    updateBaseline: false,
    threshold: 0,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--command') f.command = argv[++i]
    else if (a === '--from-file') f.fromFile = argv[++i]
    else if (a === '--dir') f.dir = argv[++i] ?? f.dir
    else if (a === '--threshold') {
      const raw = argv[++i]
      const num = Number(raw)
      if (Number.isNaN(num) || !Number.isFinite(num)) {
        throw new Error(`invalid --threshold: "${raw}" is not a valid number`)
      }
      f.threshold = num
    } else if (a === '--json') f.json = true
    else if (a === '--check') f.check = true
    else if (a === '--update-baseline') f.updateBaseline = true
    else if (a === '--inherit-env') f.inheritEnv = true
    else if (a === '--header' || a === '--env') {
      const raw = argv[++i] ?? ''
      const eq = raw.indexOf('=')
      if (eq > 0) (a === '--header' ? f.headers : f.env)[raw.slice(0, eq)] = raw.slice(eq + 1)
    } else if (a && !a.startsWith('-')) f.positional.push(a)
  }
  return f
}

const baselinePath = (dir: string, serverId: string) =>
  join(dir, `mcp-baseline.${serverId.replace(/[^a-zA-Z0-9_-]+/g, '_')}.json`)

function readBaseline(path: string): { baseline: McpBaseline | null; error?: string } {
  try {
    const raw = readFileSync(path, 'utf8')
    return { baseline: McpBaseline.parse(JSON.parse(raw)) }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { baseline: null }
    return { baseline: null, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * `echostash mcp audit <target>` — read a server's tool surface, analyze it, report.
 *
 * Deliberately offline-shaped: no Echostash server, no API key, no model calls. Same
 * local-first convention as `scan --dry-run --track`.
 */
export async function runMcp(argv: string[]): Promise<number> {
  const [sub, ...rest] = argv
  if (sub !== 'audit') {
    log(`unknown "mcp" subcommand: ${sub ?? '(none)'} — expected "audit"`)
    return 1
  }

  let flags: Flags
  try {
    flags = parseFlags(rest)
  } catch (err) {
    log(err instanceof Error ? err.message : String(err))
    return 1
  }
  let surface: McpToolSurface

  if (flags.fromFile) {
    // Lets you audit a recorded tools/list payload — handy in CI and for fixtures.
    surface = McpToolSurface.parse(JSON.parse(readFileSync(flags.fromFile, 'utf8')))
  } else {
    const raw = flags.command ?? flags.positional[0]
    if (!raw) {
      log('usage: echostash mcp audit <url|--command "npx -y @acme/server">')
      return 1
    }
    let target: McpTarget
    try {
      target = parseTarget(raw, Object.keys(flags.headers).length ? flags.headers : undefined)
      if (target.kind === 'stdio') {
        if (Object.keys(flags.env).length) target.env = flags.env
        if (flags.inheritEnv) target.inheritEnv = true
      }
    } catch (err) {
      log(err instanceof Error ? err.message : String(err))
      return 1
    }
    try {
      surface = await fetchToolSurface(target)
    } catch (err) {
      log(err instanceof Error ? err.message : String(err))
      return 1
    }
  }

  const report = analyze(surface)
  const findingCounts: Record<string, number> = {}
  for (const f of report.findings) findingCounts[f.severity] = (findingCounts[f.severity] ?? 0) + 1
  const current = toBaseline(surface, {
    score: report.score,
    tokenBudget: report.tokenBudget.total,
    findingCounts,
  })

  const path = baselinePath(flags.dir, surface.serverId)

  if (flags.check) {
    const { baseline: previous, error: baselineError } = readBaseline(path)
    if (baselineError) {
      log(`corrupt or invalid baseline at ${path} (${baselineError}) — delete or re-record it`)
      return 1
    }
    if (!previous) {
      log(`no baseline at ${path} — run \`echostash mcp audit\` first to record one`)
      return 1
    }
    const pinErr = verifyPinning(current, previous)
    if (pinErr) {
      log(`error: ${pinErr}`)
      return 1
    }
    const changes = diffBaseline(previous, current)
    const regressed = report.score < previous.score - flags.threshold
    if (flags.json) {
      console.log(
        JSON.stringify({ report, changes, previousScore: previous.score, regressed }, null, 2),
      )
    } else {
      console.log(renderReport(report))
      console.log(renderCheck(changes, previous.score, report.score, flags.threshold, regressed))
    }
    if (flags.updateBaseline) writeBaseline(path, flags.dir, current)
    return regressed ? 1 : 0
  }

  if (flags.json) console.log(JSON.stringify(report, null, 2))
  else console.log(renderReport(report))

  writeBaseline(path, flags.dir, current)
  if (!flags.json) log(`baseline written to ${path}`)
  return 0
}

function writeBaseline(path: string, dir: string, baseline: McpBaseline): void {
  mkdirSync(dir, { recursive: true })
  // Trailing newline + stable key order keeps the committed file diff-friendly.
  writeFileSync(path, `${JSON.stringify(baseline, null, 2)}\n`)
}
