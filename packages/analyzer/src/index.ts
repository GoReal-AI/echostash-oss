import { readFileSync, readdirSync } from 'node:fs'
import { basename, extname, join, relative } from 'node:path'
import type { DiscoveredPrompt, Provider, Resolution } from '@echostash/shared'
import ts from 'typescript'
import { buildScope, enclosingSymbol, extractMessages, extractModel, extractParams } from './ast'

export interface ScanOptions {
  /** Absolute path to the repo / directory to scan. */
  root: string
  /** Directory names to skip. */
  exclude?: string[]
}

const DEFAULT_EXCLUDE = ['node_modules', 'dist', '.git', '.turbo', 'coverage', 'build']
const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
const VERCEL_FNS = new Set(['generateText', 'streamText', 'generateObject', 'streamObject'])

function scriptKind(file: string): ts.ScriptKind {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX
  if (file.endsWith('.jsx')) return ts.ScriptKind.JSX
  if (file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.cjs'))
    return ts.ScriptKind.JS
  return ts.ScriptKind.TS
}

function listSourceFiles(root: string, exclude: string[]): string[] {
  const skip = new Set(exclude)
  const entries = readdirSync(root, { recursive: true, withFileTypes: true })
  const out: string[] = []
  for (const e of entries) {
    if (!e.isFile()) continue
    const rel = relative(root, join(e.parentPath ?? e.path, e.name))
    if (rel.split('/').some((seg) => skip.has(seg))) continue
    const ext = extname(e.name)
    if (!SOURCE_EXT.has(ext) || e.name.endsWith('.d.ts')) continue
    out.push(join(root, rel))
  }
  return out
}

/** `X.chat.completions.create(...)` */
function isOpenAIChatCreate(call: ts.CallExpression): boolean {
  const e = call.expression
  if (!ts.isPropertyAccessExpression(e) || e.name.text !== 'create') return false
  const completions = e.expression
  if (!ts.isPropertyAccessExpression(completions) || completions.name.text !== 'completions') {
    return false
  }
  const chat = completions.expression
  return ts.isPropertyAccessExpression(chat) && chat.name.text === 'chat'
}

/** `generateText({...})` / `streamText({...})` / ... */
function vercelFn(call: ts.CallExpression): boolean {
  return ts.isIdentifier(call.expression) && VERCEL_FNS.has(call.expression.text)
}

function optionsArg(call: ts.CallExpression): ts.ObjectLiteralExpression | undefined {
  const first = call.arguments[0]
  return first && ts.isObjectLiteralExpression(first) ? first : undefined
}

function detectInFile(sf: ts.SourceFile, relPath: string): DiscoveredPrompt[] {
  const scope = buildScope(sf)
  const results: DiscoveredPrompt[] = []
  const symbolCounts = new Map<string, number>()
  const fileBase = basename(relPath, extname(relPath))

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const isOpenAI = isOpenAIChatCreate(node)
      const isVercel = !isOpenAI && vercelFn(node)
      if (isOpenAI || isVercel) {
        const opts = optionsArg(node)
        if (opts) {
          results.push(
            buildPrompt(node, opts, sf, scope, relPath, fileBase, symbolCounts, isOpenAI),
          )
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return results
}

function buildPrompt(
  call: ts.CallExpression,
  opts: ts.ObjectLiteralExpression,
  sf: ts.SourceFile,
  scope: Map<string, ts.Expression>,
  relPath: string,
  fileBase: string,
  symbolCounts: Map<string, number>,
  isOpenAI: boolean,
): DiscoveredPrompt {
  const symbol = enclosingSymbol(call)
  const key = `${relPath}:${symbol}`
  const idx = symbolCounts.get(key) ?? 0
  symbolCounts.set(key, idx + 1)
  const fingerprint = idx === 0 ? key : `${key}#${idx}`

  const modelProp = opts.properties.find(
    (p): p is ts.PropertyAssignment =>
      ts.isPropertyAssignment(p) && p.name?.getText(sf) === 'model',
  )
  let provider: Provider | null = isOpenAI ? 'openai' : null
  let model: string | null = null
  if (modelProp) {
    const m = extractModel(modelProp.initializer, sf, scope)
    model = m.model
    provider = m.provider ?? provider
  }

  const params = extractParams(opts, sf)
  const { messages, resolution: msgResolution } = extractMessages(opts, sf, scope)
  const resolution: Resolution = messages.length === 0 ? 'dynamic' : msgResolution

  const line = sf.getLineAndCharacterOfPosition(call.getStart(sf)).line + 1

  return {
    fingerprint,
    name: symbol === 'module' ? fileBase : symbol,
    content: [],
    messages,
    provider,
    model,
    params,
    resolution,
    filePath: relPath,
    symbol: symbol === 'module' ? null : symbol,
    line,
  }
}

/** Walk source files, find LLM call sites, resolve prompt/model/params at each. */
export async function scan(options: ScanOptions): Promise<DiscoveredPrompt[]> {
  const exclude = options.exclude ?? DEFAULT_EXCLUDE
  const files = listSourceFiles(options.root, exclude)
  const out: DiscoveredPrompt[] = []
  for (const abs of files) {
    let text: string
    try {
      text = readFileSync(abs, 'utf8')
    } catch {
      continue
    }
    const rel = relative(options.root, abs)
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, scriptKind(abs))
    out.push(...detectInFile(sf, rel))
  }
  return out
}

export const ANALYZER_MILESTONE = 'M2' as const
