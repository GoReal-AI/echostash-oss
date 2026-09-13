#!/usr/bin/env node
// Turns the CLI's `mcp audit --check --json` result into step outputs, a job summary and a PR
// comment body. Fails closed: anything that is not a well-formed check result exits 1, so a
// missing baseline, an unreachable server or a crashed CLI can never show up as a green gate.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] ?? ''])
    return acc
  }, []),
)

const read = (p) => {
  try {
    return readFileSync(p, 'utf8')
  } catch {
    return ''
  }
}
const fail = (msg) => {
  console.log(`::error::${msg}`)
  process.exit(1)
}

const exit = Number(args.exit ?? '1')
const threshold = Number(args.threshold ?? '0')
const stderr = read(args.stderr).trim()
const stdout = read(args.json).trim()

let result
try {
  result = JSON.parse(stdout)
} catch {
  fail(stderr || `echostash mcp audit produced no JSON (exit ${exit})`)
}
const { report, changes, previousScore, regressed } = result ?? {}
if (
  !report ||
  typeof report.score !== 'number' ||
  typeof previousScore !== 'number' ||
  typeof regressed !== 'boolean' ||
  !Array.isArray(changes)
) {
  fail(stderr || `echostash mcp audit returned an unexpected payload (exit ${exit})`)
}
// The CLI exits 1 for a regression, which we handle below, and for errors, which we must not
// swallow. A non-zero exit that is not a regression is an error by definition.
if (exit !== 0 && !regressed) fail(stderr || `echostash mcp audit exited ${exit}`)

const delta = Number((report.score - previousScore).toFixed(1))
const marker = `<!-- echostash-mcp-audit:${report.serverId} -->`

const out = (k, v) => {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`)
}
out('score', report.score)
out('previous_score', previousScore)
out('delta', delta)
out('regressed', regressed ? 'true' : 'false')
out('marker', marker)

const CHANGE_LABEL = {
  added: 'added',
  removed: 'removed',
  'description-changed': 'description changed',
  'schema-changed': 'schema changed',
}
const SEVERITY_ICON = { error: '🔴', warn: '🟠', info: '🔵' }
const signed = delta > 0 ? `+${delta}` : `${delta}`
const status = regressed
  ? `❌ **Regressed** (past the ${threshold}-point threshold)`
  : delta < 0
    ? `⚠️ **Passed** (dropped ${Math.abs(delta)}, within the ${threshold}-point threshold)`
    : '✅ **Passed**'

const lines = [
  marker,
  `### Echostash MCP tool surface audit: \`${report.serverName}\``,
  '',
  `${status}  ·  score **${previousScore} → ${report.score}** (${signed})  ·  ${report.toolCount} tools  ·  ~${report.tokenBudget.total} tokens/request`,
  '',
]

if (changes.length === 0) {
  lines.push('_No tool changes since the baseline._', '')
} else {
  lines.push('| Tool | Change |', '| :--- | :--- |')
  for (const ch of changes)
    lines.push(`| \`${ch.name}\` | ${CHANGE_LABEL[ch.status] ?? ch.status} |`)
  lines.push('')
}

if (report.findings.length > 0) {
  const changed = new Set(changes.map((c) => c.name))
  const pick = (f) => changed.size === 0 || changed.has(f.tool)
  const shown = report.findings.filter(pick)
  const rest = report.findings.length - shown.length
  lines.push(
    `<details><summary>${report.findings.length} finding${report.findings.length === 1 ? '' : 's'}${
      rest > 0 ? ` (${shown.length} on changed tools)` : ''
    }</summary>`,
    '',
    '| | Check | Tool | Message |',
    '| :-- | :--- | :--- | :--- |',
  )
  for (const f of shown) {
    lines.push(
      `| ${SEVERITY_ICON[f.severity] ?? ''} | \`${f.check}\` | \`${f.tool ?? ''}\` | ${f.message.replace(/\|/g, '\\|')} |`,
    )
  }
  if (rest > 0) lines.push('', `_…and ${rest} more on unchanged tools._`)
  lines.push('', '</details>', '')
}

lines.push(
  '<sub>Deterministic audit by <a href="https://github.com/GoReal-AI/echostash-oss">Echostash</a>: no API key, no model calls. Re-record the baseline with <code>echostash mcp audit</code> when a drop is intentional.</sub>',
  '',
)

const md = lines.join('\n')
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`)
if (args.comment) writeFileSync(args.comment, md)
console.log(md)
