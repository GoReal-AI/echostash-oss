import type { ToolChange } from '@echostash/mcp'
import type { McpAuditReport, McpFinding, McpSeverity } from '@echostash/shared'

const useColor = process.stdout.isTTY && !process.env.NO_COLOR
const c = (code: string, s: string) => (useColor ? `\u001b[${code}m${s}\u001b[0m` : s)
const bold = (s: string) => c('1', s)
const dim = (s: string) => c('2', s)
const red = (s: string) => c('31', s)
const yellow = (s: string) => c('33', s)
const green = (s: string) => c('32', s)
const cyan = (s: string) => c('36', s)

const MARK: Record<McpSeverity, string> = { error: 'x', warn: '!', info: '-' }
const PAINT: Record<McpSeverity, (s: string) => string> = { error: red, warn: yellow, info: dim }

function scoreColor(score: number): (s: string) => string {
  if (score >= 85) return green
  if (score >= 65) return yellow
  return red
}

/** Group findings by check so a surface with 40 identical problems reads as one line, not 40. */
function group(findings: McpFinding[]): Map<string, McpFinding[]> {
  const out = new Map<string, McpFinding[]>()
  for (const f of findings) {
    const list = out.get(f.check)
    if (list) list.push(f)
    else out.set(f.check, [f])
  }
  return out
}

export function renderReport(report: McpAuditReport): string {
  const lines: string[] = []
  const paintScore = scoreColor(report.score)

  lines.push('')
  lines.push(`  ${bold(report.serverName)} ${dim(`· ${report.toolCount} tools`)}`)
  if (report.protocolVersion) lines.push(`  ${dim(`protocol ${report.protocolVersion}`)}`)
  lines.push('')
  lines.push(
    `  Tool Surface Score  ${paintScore(bold(String(report.score)))}${dim('/100')}` +
      `     ${dim('context cost')} ${cyan(`~${report.tokenBudget.total.toLocaleString('en-US')}`)} ${dim('tokens/request')}`,
  )

  const heaviest = report.tokenBudget.perTool.slice(0, 3)
  if (heaviest.length > 0) {
    lines.push(`  ${dim(`heaviest: ${heaviest.map((t) => `${t.tool} ~${t.tokens}`).join(', ')}`)}`)
  }
  lines.push('')

  if (report.findings.length === 0) {
    lines.push(`  ${green('No findings.')}`)
    lines.push('')
    return lines.join('\n')
  }

  const counts = { error: 0, warn: 0, info: 0 }
  for (const f of report.findings) counts[f.severity]++
  lines.push(
    `  ${red(`${counts.error} error`)}  ${yellow(`${counts.warn} warn`)}  ${dim(`${counts.info} info`)}`,
  )
  lines.push('')

  for (const [check, items] of group(report.findings)) {
    const severity = items[0]?.severity ?? 'info'
    lines.push(`  ${PAINT[severity](MARK[severity])} ${bold(check)} ${dim(`(${items.length})`)}`)
    for (const f of items) {
      lines.push(`      ${f.message}`)
    }
    const hint = items.find((f) => f.hint)?.hint
    if (hint) lines.push(`      ${dim(`→ ${hint}`)}`)
    lines.push('')
  }

  return lines.join('\n')
}

const CHANGE_LABEL: Record<ToolChange['status'], string> = {
  added: 'added',
  removed: 'removed',
  'description-changed': 'description changed',
  'schema-changed': 'schema changed',
}

export function renderCheck(
  changes: ToolChange[],
  previousScore: number,
  currentScore: number,
  threshold: number,
  regressed: boolean,
): string {
  const lines: string[] = []
  const delta = Number((currentScore - previousScore).toFixed(1))
  const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '='
  const paint = delta < 0 ? red : delta > 0 ? green : dim

  lines.push('')
  if (changes.length === 0) {
    lines.push(`  ${dim('No tool changes since the baseline.')}`)
  } else {
    lines.push(`  ${bold('Changed tools')}`)
    for (const ch of changes) {
      lines.push(`      ${cyan(ch.name)} ${dim(CHANGE_LABEL[ch.status])}`)
    }
  }
  lines.push('')
  lines.push(
    `  Score ${dim(String(previousScore))} → ${bold(String(currentScore))}  ` +
      `${paint(`${arrow} ${delta > 0 ? '+' : ''}${delta}`)}  ${dim(`(threshold ${threshold})`)}`,
  )
  lines.push('')
  lines.push(
    regressed
      ? `  ${red(bold('FAIL'))} — the tool surface regressed past the threshold.`
      : `  ${green(bold('PASS'))}`,
  )
  lines.push('')
  return lines.join('\n')
}
