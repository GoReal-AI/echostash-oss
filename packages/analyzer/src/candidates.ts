import type { Resolution } from '@echostash/shared'
import ts from 'typescript'
import { buildScope, enclosingSymbol, resolveString } from './ast'

/** Identifier words that strongly mark a prompt (whole-word, so `errorMessage` is NOT a hit). */
const STRONG_NAME = new Set([
  'prompt',
  'system',
  'instruction',
  'instructions',
  'persona',
  'rubric',
])

/** Content markers that suggest a string is addressed to an LLM. */
const CONTENT_RE =
  /you are |your task|respond with|you must|do not |answer the|\{\{|step[- ]by[- ]step|system prompt|\bassistant\b/i

function nameWords(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase())
}

export interface Candidate {
  name: string | null
  symbol: string | null
  text: string
  resolution: Resolution
  filePath: string
  line: number
  tier: 'definite' | 'candidate'
  role: 'system' | 'user'
}

const isStringLike = (n: ts.Node): boolean =>
  ts.isStringLiteralLike(n) ||
  ts.isNoSubstitutionTemplateLiteral(n) ||
  ts.isTemplateExpression(n) ||
  (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken)

/**
 * Phase 2 — deterministically gather *candidate* prompt strings from a file.
 * A string bound to a prompt-named symbol is `definite` (no LLM needed); a long,
 * content-marked string with no telltale name is a `candidate` (the LLM adjudicates).
 * Everything else is ignored. This is what bounds the model: it only ever sees a
 * deterministically-produced shortlist.
 */
export function collectCandidates(sf: ts.SourceFile, relPath: string): Candidate[] {
  const scope = buildScope(sf)
  const out: Candidate[] = []
  const seen = new Set<string>()

  const consider = (name: string | null, value: ts.Node, anchor: ts.Node): void => {
    if (!isStringLike(value)) return
    const { text, resolution } = resolveString(value as ts.Expression, sf, scope)
    if (!text || resolution === 'dynamic' || text.length < 16) return

    const words = name ? nameWords(name) : []
    const nameStrong = words.some((w) => STRONG_NAME.has(w))
    const content = CONTENT_RE.test(text)
    const long = text.length >= 80 || text.includes('\n')

    let tier: Candidate['tier'] | null = null
    if (nameStrong) tier = 'definite'
    else if (long && content) tier = 'candidate'
    if (!tier) return

    const line = sf.getLineAndCharacterOfPosition(anchor.getStart(sf)).line + 1
    const key = `${relPath}:${name ?? 'anon'}:${line}`
    if (seen.has(key)) return
    seen.add(key)

    out.push({
      name,
      symbol: enclosingSymbol(anchor),
      text,
      resolution,
      filePath: relPath,
      line,
      tier,
      role: words.includes('user') ? 'user' : 'system',
    })
  }

  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      consider(node.name.text, node.initializer, node)
    } else if (ts.isPropertyAssignment(node) && node.initializer) {
      consider(node.name.getText(sf), node.initializer, node)
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}
