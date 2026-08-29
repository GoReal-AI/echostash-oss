import type { McpCase, McpToolSurface } from '@echostash/shared'

export interface ToolCallDecision {
  toolName: string | null
}

export interface McpEvalCaseResult {
  caseId: string
  query: string
  source: 'manual' | 'generated'
  expected: string | null
  actual: string | null
  correct: boolean
}

export interface McpConfusionMatrix {
  labels: string[] // tool names + '(none)'
  matrix: Record<string, Record<string, number>> // [expected][actual] -> count
}

export interface McpEvalReport {
  server: string
  totalCases: number
  overallAccuracy: number
  manualAccuracy: number | null
  generatedAccuracy: number | null
  results: McpEvalCaseResult[]
  confusionMatrix: McpConfusionMatrix
}

/**
 * Evaluates tool selection accuracy against a set of human or synthetic test cases,
 * generating a full confusion matrix showing cross-tool routing confusion.
 */
export async function evaluateToolSelection(
  surface: McpToolSurface,
  cases: McpCase[],
  decideFn: (query: string, tools: McpToolSurface['tools']) => Promise<ToolCallDecision>,
): Promise<McpEvalReport> {
  const toolNames = surface.tools.map((t) => t.name)
  const labels = [...toolNames, '(none)']

  const matrix: Record<string, Record<string, number>> = {}
  for (const exp of labels) {
    matrix[exp] = {}
    for (const act of labels) {
      matrix[exp]![act] = 0
    }
  }

  const results: McpEvalCaseResult[] = []
  let manualCorrect = 0
  let manualTotal = 0
  let genCorrect = 0
  let genTotal = 0

  for (const c of cases) {
    const decision = await decideFn(c.query, surface.tools)
    const expectedLabel = c.expectTool ?? '(none)'
    const actualLabel = decision.toolName ?? '(none)'

    const correct = expectedLabel === actualLabel
    if (matrix[expectedLabel] && matrix[expectedLabel]![actualLabel] !== undefined) {
      matrix[expectedLabel]![actualLabel]!++
    }

    if (c.source === 'manual') {
      manualTotal++
      if (correct) manualCorrect++
    } else {
      genTotal++
      if (correct) genCorrect++
    }

    results.push({
      caseId: c.id,
      query: c.query,
      source: c.source,
      expected: c.expectTool,
      actual: decision.toolName,
      correct,
    })
  }

  const totalCases = cases.length
  const totalCorrect = manualCorrect + genCorrect
  const overallAccuracy = totalCases > 0 ? totalCorrect / totalCases : 1
  const manualAccuracy = manualTotal > 0 ? manualCorrect / manualTotal : null
  const generatedAccuracy = genTotal > 0 ? genCorrect / genTotal : null

  return {
    server: surface.serverId,
    totalCases,
    overallAccuracy,
    manualAccuracy,
    generatedAccuracy,
    results,
    confusionMatrix: {
      labels,
      matrix,
    },
  }
}

/**
 * Renders the confusion matrix and evaluation report for terminal presentation.
 */
export function renderEvalReport(report: McpEvalReport): string {
  const lines: string[] = []
  lines.push(`MCP Tool Selection Evaluation — ${report.server}`)
  lines.push(`Total cases: ${report.totalCases}`)
  lines.push(`Overall Accuracy: ${(report.overallAccuracy * 100).toFixed(1)}%`)
  if (report.manualAccuracy !== null) {
    lines.push(`  Manual (Ground Truth): ${(report.manualAccuracy * 100).toFixed(1)}%`)
  }
  if (report.generatedAccuracy !== null) {
    lines.push(`  Generated (Coverage): ${(report.generatedAccuracy * 100).toFixed(1)}%`)
  }
  lines.push('')
  lines.push('Confusion Matrix (Expected ↓ \\ Actual →):')

  const labels = report.confusionMatrix.labels
  const header = ['Expected / Actual', ...labels].map((l) => l.padEnd(16)).join(' | ')
  lines.push(header)
  lines.push('-'.repeat(header.length))

  for (const exp of labels) {
    const row = [exp.padEnd(16)]
    for (const act of labels) {
      const count = report.confusionMatrix.matrix[exp]?.[act] ?? 0
      const isDiagonal = exp === act
      const formatted = isDiagonal ? `${count}` : count > 0 ? `! ${count}` : '0'
      row.push(formatted.padEnd(16))
    }
    lines.push(row.join(' | '))
  }

  return lines.join('\n')
}
