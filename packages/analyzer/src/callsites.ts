import { basename, extname } from 'node:path'
import type { DiscoveredPrompt, Provider, Resolution } from '@echostash/shared'
import ts from 'typescript'
import { buildScope, enclosingSymbol, extractMessages, extractModel, extractParams } from './ast'

const VERCEL_FNS = new Set(['generateText', 'streamText', 'generateObject', 'streamObject'])

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

function vercelFn(call: ts.CallExpression): boolean {
  return ts.isIdentifier(call.expression) && VERCEL_FNS.has(call.expression.text)
}

function optionsArg(call: ts.CallExpression): ts.ObjectLiteralExpression | undefined {
  const first = call.arguments[0]
  return first && ts.isObjectLiteralExpression(first) ? first : undefined
}

/**
 * Phase 3 — known LLM call sites (OpenAI / Vercel AI SDK). These give us model +
 * params inline, which the string-candidate path can't. Merged with candidates by
 * fingerprint in scan().
 */
export function detectCallSites(sf: ts.SourceFile, relPath: string): DiscoveredPrompt[] {
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
          results.push(build(node, opts, sf, scope, relPath, fileBase, symbolCounts, isOpenAI))
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return results
}

function build(
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
