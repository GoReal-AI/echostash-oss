import type { Message, ModelParams, Provider, Resolution } from '@echostash/shared'
import ts from 'typescript'

export interface Resolved {
  text: string
  resolution: Resolution
}

/** Worst-case combination: dynamic > partial > resolved. */
export function combine(a: Resolution, b: Resolution): Resolution {
  if (a === 'dynamic' || b === 'dynamic') return 'dynamic'
  if (a === 'partial' || b === 'partial') return 'partial'
  return 'resolved'
}

/** Map of top-level/function-scoped `const x = <literal>` bindings, name -> initializer. */
export function buildScope(sf: ts.SourceFile): Map<string, ts.Expression> {
  const scope = new Map<string, ts.Expression>()
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      scope.set(node.name.text, node.initializer)
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return scope
}

/** Resolve a string-ish expression to text + how confidently we resolved it. */
export function resolveString(
  node: ts.Expression,
  sf: ts.SourceFile,
  scope: Map<string, ts.Expression>,
  depth = 0,
): Resolved {
  if (ts.isStringLiteralLike(node)) {
    return { text: node.text, resolution: 'resolved' }
  }
  if (ts.isNoSubstitutionTemplateLiteral(node)) {
    return { text: node.text, resolution: 'resolved' }
  }
  if (ts.isTemplateExpression(node)) {
    let text = node.head.text
    for (const span of node.templateSpans) {
      text += `{{${span.expression.getText(sf).trim()}}}${span.literal.text}`
    }
    return { text, resolution: 'partial' }
  }
  if (ts.isIdentifier(node) && depth < 5) {
    const bound = scope.get(node.text)
    if (bound) return resolveString(bound, sf, scope, depth + 1)
    return { text: '', resolution: 'dynamic' }
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = resolveString(node.left, sf, scope, depth + 1)
    const right = resolveString(node.right, sf, scope, depth + 1)
    return { text: left.text + right.text, resolution: combine(left.resolution, right.resolution) }
  }
  return { text: '', resolution: 'dynamic' }
}

function literalNumber(node: ts.Expression): number | undefined {
  if (ts.isNumericLiteral(node)) return Number(node.text)
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  ) {
    return -Number(node.operand.text)
  }
  return undefined
}

const PARAM_KEYS: Record<string, keyof ModelParams> = {
  temperature: 'temperature',
  top_p: 'topP',
  topP: 'topP',
  top_k: 'topK',
  topK: 'topK',
  max_tokens: 'maxTokens',
  maxTokens: 'maxTokens',
  max_output_tokens: 'maxTokens',
  seed: 'seed',
  presence_penalty: 'presencePenalty',
  presencePenalty: 'presencePenalty',
  frequency_penalty: 'frequencyPenalty',
  frequencyPenalty: 'frequencyPenalty',
}

export function extractParams(obj: ts.ObjectLiteralExpression, sf: ts.SourceFile): ModelParams {
  const params: ModelParams = {}
  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop) || !prop.name) continue
    const key = prop.name.getText(sf)
    const mapped = PARAM_KEYS[key]
    if (!mapped) continue
    if (mapped === 'stop') continue
    const num = literalNumber(prop.initializer)
    if (num !== undefined) params[mapped] = num
  }
  // stop can be a string or string[]
  const stopProp = obj.properties.find(
    (p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && p.name?.getText(sf) === 'stop',
  )
  if (stopProp) {
    if (ts.isStringLiteralLike(stopProp.initializer)) params.stop = stopProp.initializer.text
    else if (ts.isArrayLiteralExpression(stopProp.initializer)) {
      const items = stopProp.initializer.elements.filter(ts.isStringLiteralLike).map((e) => e.text)
      if (items.length) params.stop = items
    }
  }
  return params
}

const PROVIDER_FACTORY: Record<string, Provider> = {
  openai: 'openai',
  createOpenAI: 'openai',
  anthropic: 'anthropic',
  createAnthropic: 'anthropic',
  google: 'google',
  createGoogleGenerativeAI: 'google',
  vertex: 'vertex',
  createVertex: 'vertex',
}

/** Extract model + provider from a `model:` property value. */
export function extractModel(
  value: ts.Expression,
  sf: ts.SourceFile,
  scope: Map<string, ts.Expression>,
): { provider: Provider | null; model: string | null } {
  // Vercel style: model: openai('gpt-4o')
  if (ts.isCallExpression(value) && ts.isIdentifier(value.expression)) {
    const provider = PROVIDER_FACTORY[value.expression.text] ?? null
    const first = value.arguments[0]
    const model = first && ts.isStringLiteralLike(first) ? first.text : null
    return { provider, model }
  }
  // Plain string (OpenAI SDK style): model: 'gpt-4o'
  const resolved = resolveString(value, sf, scope)
  return { provider: null, model: resolved.text || null }
}

function findProp(
  obj: ts.ObjectLiteralExpression,
  sf: ts.SourceFile,
  name: string,
): ts.Expression | undefined {
  for (const prop of obj.properties) {
    if (ts.isPropertyAssignment(prop) && prop.name?.getText(sf) === name) return prop.initializer
  }
  return undefined
}

const ROLES = new Set(['system', 'user', 'assistant', 'tool'])

/** Extract messages from an options object (handles `messages`, `prompt`, `system`). */
export function extractMessages(
  obj: ts.ObjectLiteralExpression,
  sf: ts.SourceFile,
  scope: Map<string, ts.Expression>,
): { messages: Message[]; resolution: Resolution } {
  const messages: Message[] = []
  let resolution: Resolution = 'resolved'

  const system = findProp(obj, sf, 'system')
  if (system) {
    const r = resolveString(system, sf, scope)
    resolution = combine(resolution, r.resolution)
    messages.push({ role: 'system', content: r.text })
  }

  const msgs = findProp(obj, sf, 'messages')
  if (msgs && ts.isArrayLiteralExpression(msgs)) {
    for (const el of msgs.elements) {
      if (!ts.isObjectLiteralExpression(el)) {
        resolution = combine(resolution, 'dynamic')
        continue
      }
      const roleNode = findProp(el, sf, 'role')
      const contentNode = findProp(el, sf, 'content')
      const role =
        roleNode && ts.isStringLiteralLike(roleNode) && ROLES.has(roleNode.text)
          ? (roleNode.text as Message['role'])
          : 'user'
      const r = contentNode
        ? resolveString(contentNode, sf, scope)
        : { text: '', resolution: 'dynamic' as Resolution }
      resolution = combine(resolution, r.resolution)
      messages.push({ role, content: r.text })
    }
  } else if (msgs) {
    // messages is a variable/spread we can't statically expand
    resolution = combine(resolution, 'dynamic')
  }

  const prompt = findProp(obj, sf, 'prompt')
  if (prompt) {
    const r = resolveString(prompt, sf, scope)
    resolution = combine(resolution, r.resolution)
    messages.push({ role: 'user', content: r.text })
  }

  return { messages, resolution }
}

/** Nearest named enclosing function/method/var/class, for the call-site fingerprint. */
export function enclosingSymbol(node: ts.Node): string {
  let cur: ts.Node | undefined = node.parent
  while (cur) {
    if ((ts.isFunctionDeclaration(cur) || ts.isMethodDeclaration(cur)) && cur.name) {
      return cur.name.getText()
    }
    if (ts.isVariableDeclaration(cur) && ts.isIdentifier(cur.name)) {
      return cur.name.text
    }
    if (ts.isPropertyAssignment(cur) && cur.name) {
      return cur.name.getText()
    }
    if (ts.isClassDeclaration(cur) && cur.name) {
      return cur.name.getText()
    }
    cur = cur.parent
  }
  return 'module'
}
