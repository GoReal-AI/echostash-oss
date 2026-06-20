import { readFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import type { DiscoveredPrompt, Message, Provider, Resolution } from '@echostash/shared'
import { CATALOG, type CallShape, PROMPT_KEYS, STRUCTURAL, providerFromModel } from './catalog'
import { followFileRead, resolveIdentifier } from './resolve'
import { COMMON_EXCLUDES, rg } from './rgexec'

export interface AnchoredOptions {
  onLog?: (msg: string) => void
  /** Extra call shapes discovered by the LLM augment pass (custom wrappers). */
  extraShapes?: CallShape[]
  /** Limit the scan to these files (incremental re-scan). */
  scopeFiles?: string[]
}

const STRING_VAL = /^\s*(["'`])((?:\\.|(?!\1)[\s\S])*)\1/
const IDENT_VAL = /^\s*([A-Za-z_$][\w$.]*)/

/** A located LLM call site, with the call shape that matched it. */
interface CallSite {
  file: string
  line: number
  shape: CallShape
}

/** Where a prompt-bearing identifier is defined — the prompt's true home for change-tracking. */
interface PromptDef {
  file: string
  line: number
  name: string
}

/** Minimum chars for a structural scalar string to count as a prompt (named idents always count). */
const MIN_STRUCT_LEN = 12

const OPEN: Record<string, string> = { '(': ')', '[': ']', '{': '}' }
const CLOSE = new Set([')', ']', '}'])

/**
 * Read the argument/value window starting at line `idx` (0-based): balances ()/[]/{} so an object,
 * array, or call argument is captured whole. If no bracket opens on the first line (a scalar
 * same-line value like `systemPrompt: FOO,`), just that line is returned.
 */
function callWindow(lines: string[], idx: number): string {
  let depth = 0
  let started = false
  let out = ''
  for (let i = idx; i < lines.length && i < idx + 80; i++) {
    const line = lines[i] ?? ''
    out += (i === idx ? '' : '\n') + line
    for (const ch of line) {
      if (OPEN[ch]) {
        depth++
        started = true
      } else if (CLOSE.has(ch)) {
        depth--
      }
    }
    if (started && depth <= 0) break
    // scalar value with no bracket: the value may sit on the next line(s) (or be `"a" + "b"`),
    // so read a small window rather than stopping at the key line.
    if (!started && i >= idx + 8) break
  }
  return out
}

/** Split the outermost call `( … )` in `window` into its top-level argument expressions. */
function callArgs(window: string): string[] {
  const open = window.indexOf('(')
  if (open === -1) return []
  const args: string[] = []
  let cur = ''
  let paren = 0
  let nest = 0
  let inStr: string | null = null
  for (let i = open; i < window.length; i++) {
    const ch = window[i] ?? ''
    if (inStr) {
      cur += ch
      if (ch === inStr && window[i - 1] !== '\\') inStr = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch
      cur += ch
      continue
    }
    if (ch === '(') {
      paren++
      nest++
      if (paren === 1) continue // the call's own opener
    } else if (ch === ')') {
      paren--
      nest--
      if (paren === 0) {
        if (cur.trim()) args.push(cur.trim())
        break
      }
    } else if (ch === '[' || ch === '{') {
      nest++
    } else if (ch === ']' || ch === '}') {
      nest--
    } else if (ch === ',' && nest === 1) {
      args.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  return args
}

/** Join consecutive `"a" + "b" + …` string literals into one (handles split prompt strings). */
function readConcatenated(rest: string): string | null {
  let out = ''
  let s = rest
  let matched = false
  for (let n = 0; n < 64; n++) {
    const m = s.match(STRING_VAL)
    if (!m) break
    out += m[2] ?? ''
    matched = true
    s = s.slice((m[0] ?? '').length)
    const plus = s.match(/^\s*\+\s*/)
    if (!plus) break
    s = s.slice(plus[0].length)
  }
  return matched ? out : null
}

/** Pull the value that follows `key <:|=>` in the window: a string literal (concatenated) or identifier. */
function valueAfterKey(
  window: string,
  key: string,
): { kind: 'string' | 'ident'; raw: string } | null {
  const m = window.match(new RegExp(`\\b${key}\\s*[:=]\\s*`))
  if (!m || m.index === undefined) return null
  const rest = window.slice(m.index + m[0].length)
  const str = readConcatenated(rest)
  if (str !== null) return { kind: 'string', raw: str }
  const id = rest.match(IDENT_VAL)
  if (id?.[1]) return { kind: 'ident', raw: id[1] }
  return null
}

/** Numeric model params present in the window. */
function parseParams(window: string): Record<string, number> {
  const params: Record<string, number> = {}
  const keys: Record<string, string> = {
    temperature: 'temperature',
    top_p: 'topP',
    topP: 'topP',
    max_tokens: 'maxTokens',
    maxTokens: 'maxTokens',
    maxOutputTokens: 'maxTokens',
    max_output_tokens: 'maxTokens',
    seed: 'seed',
  }
  for (const [k, norm] of Object.entries(keys)) {
    const m = window.match(new RegExp(`\\b${k}\\s*[:=]\\s*([0-9]+(?:\\.[0-9]+)?)`))
    if (m?.[1] && params[norm] === undefined) params[norm] = Number(m[1])
  }
  return params
}

/** Parse a `messages: [ {role, content}, … ]` array (flat objects) into resolved messages. */
function parseMessagesArray(
  window: string,
  resolveVal: (id: string) => string | null,
): { messages: Message[]; dynamic: boolean } {
  const start = window.search(/\b(messages|contents)\s*[:=]\s*\[/)
  const messages: Message[] = []
  let dynamic = false
  if (start === -1) return { messages, dynamic }
  const arr = window.slice(window.indexOf('[', start))
  for (const obj of arr.match(/\{[^{}]*\}/g) ?? []) {
    const role = (obj.match(/role\s*[:=]\s*['"]([^'"]+)['"]/)?.[1] ?? 'user') as Message['role']
    const str = obj.match(/content\s*[:=]\s*(["'`])((?:\\.|(?!\1)[\s\S])*)\1/)
    if (str?.[2] !== undefined) {
      if (str[2].trim()) messages.push({ role, content: str[2] })
      continue
    }
    const id = obj.match(/content\s*[:=]\s*([A-Za-z_$][\w$.]*)/)
    if (id?.[1]) {
      const text = resolveVal(id[1])
      if (text) messages.push({ role, content: text })
      else dynamic = true
    }
  }
  return { messages, dynamic }
}

const isCodeFile = (f: string) =>
  ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.java', '.kt', '.go', '.rb'].includes(
    extname(f),
  )

/** Find call sites for one shape across the repo (or within scopeFiles). */
function locate(root: string, shape: CallShape, scope: Set<string> | null): CallSite[] {
  const args = ['-n', '--no-heading', ...COMMON_EXCLUDES, '-g', '!*.test.*', '-g', '!*.spec.*']
  for (const p of shape.patterns) args.push('-e', p)
  const sites: CallSite[] = []
  for (const m of rg(args, root)) {
    const c1 = m.indexOf(':')
    const c2 = m.indexOf(':', c1 + 1)
    if (c1 === -1 || c2 === -1) continue
    const file = m.slice(0, c1)
    const line = Number(m.slice(c1 + 1, c2))
    if (!line || !isCodeFile(file)) continue
    if (scope && !scope.has(file)) continue
    sites.push({ file, line, shape })
  }
  return sites
}

/** The enclosing function/method/const name above a call line, for a stable fingerprint. */
function enclosingSymbol(lines: string[], lineIdx: number): string | null {
  for (let i = lineIdx; i >= Math.max(0, lineIdx - 60); i--) {
    const m = (lines[i] ?? '').match(
      /(?:function|def|const|let|var|val|fun)\s+([A-Za-z_$][\w$]*)|([A-Za-z_$][\w$]*)\s*(?:=|:)\s*(?:async\s*)?\(/,
    )
    if (m) return m[1] ?? m[2] ?? null
    const method = (lines[i] ?? '').match(
      /(?:public|private|protected|static|\s)\s*[\w<>[\]]+\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/,
    )
    if (method?.[1]) return method[1]
  }
  return null
}

/**
 * Usage-anchored discovery: find LLM call sites (catalog + LLM-augmented shapes), then resolve the
 * prompt argument back to its source (literal / variable / file). A string is reported only when it
 * actually flows into an LLM call — high precision, near-zero false positives.
 */
export function anchoredDiscover(root: string, opts: AnchoredOptions = {}): DiscoveredPrompt[] {
  const onLog = opts.onLog ?? (() => {})
  const shapes = [...CATALOG, ...(opts.extraShapes ?? []), STRUCTURAL]
  const scope = opts.scopeFiles ? new Set(opts.scopeFiles) : null

  const sites: CallSite[] = []
  for (const shape of shapes) {
    const found = locate(root, shape, scope)
    if (found.length) onLog(`call shape ${shape.id} → ${found.length} site(s)`)
    sites.push(...found)
  }
  onLog(`${sites.length} LLM call site(s) total`)

  const fileCache = new Map<string, string[]>()
  const linesOf = (file: string): string[] | null => {
    if (fileCache.has(file)) return fileCache.get(file) ?? null
    try {
      const l = readFileSync(join(root, file), 'utf8').split('\n')
      fileCache.set(file, l)
      return l
    } catch {
      return null
    }
  }

  const out: DiscoveredPrompt[] = []
  const seen = new Set<string>()

  for (const site of sites) {
    const lines = linesOf(site.file)
    if (!lines) continue
    const idx = site.line - 1
    const window = callWindow(lines, idx)
    // The definition a prompt-bearing identifier resolves to — its true home for change-tracking.
    // Held on an object so it survives mutation inside the resolveVal closure without a cast.
    const resolved: { def: PromptDef | null } = { def: null }
    const resolveVal = (id: string): string | null => {
      const r = resolveIdentifier(root, site.file, lines, id)
      if (r && !resolved.def) resolved.def = { file: r.file, line: r.fromLine, name: id }
      return r?.text.trim() ?? null
    }

    // model (from the call window, else a model declared elsewhere in the same file)
    let model: string | null = null
    const mv = valueAfterKey(window, 'model')
    if (mv)
      model =
        mv.kind === 'string'
          ? mv.raw
          : (resolveIdentifier(root, site.file, lines, mv.raw)?.text.trim() ?? null)
    if (!model) {
      const fileModel = lines
        .join('\n')
        .match(/(?:model|modelName|model_name)\s*[:=]\s*["'`]([\w.:/-]+)["'`]/)
      model = fileModel?.[1] ?? null
    }
    const provider: Provider | null = site.shape.provider ?? providerFromModel(model)
    const params = parseParams(window)

    // messages
    const messages: Message[] = []
    let dynamic = false
    const arr = parseMessagesArray(window, resolveVal)
    messages.push(...arr.messages)
    dynamic ||= arr.dynamic

    /** Resolve an argument expression to prompt text: string literal, file read, or traced identifier. */
    const resolveArg = (expr: string | undefined): string | null => {
      if (!expr) return null
      const str = readConcatenated(expr)
      if (str?.trim()) return str.trim()
      const file = followFileRead(root, site.file, expr)
      if (file?.text.trim()) return file.text.trim()
      const id = expr.match(IDENT_VAL)
      return id?.[1] ? resolveVal(id[1]) : null
    }

    const structural = site.shape.kind === 'structural'
    for (const [key, role] of Object.entries(PROMPT_KEYS)) {
      if (role === 'array') continue
      const v = valueAfterKey(window, key)
      if (!v) continue
      if (v.kind === 'string') {
        const min = structural ? MIN_STRUCT_LEN : 1
        if (v.raw.trim().length >= min) messages.push({ role, content: v.raw })
      } else {
        const file = followFileRead(root, site.file, window)
        const text = file?.text.trim() ?? resolveVal(v.raw)
        if (text) messages.push({ role, content: text })
        else dynamic = true
      }
    }

    // Custom-wrapper prompt arg pinpointed by the LLM augment (positional index or a named key).
    if (site.shape.promptArg !== undefined && messages.length === 0) {
      const pa = site.shape.promptArg
      if (typeof pa === 'number') {
        const text = resolveArg(callArgs(window)[pa])
        if (text) messages.push({ role: 'system', content: text })
        else dynamic = true
      } else {
        const v = valueAfterKey(window, pa)
        const text = v?.kind === 'string' ? v.raw : v?.kind === 'ident' ? resolveVal(v.raw) : null
        if (text?.trim()) messages.push({ role: 'system', content: text })
        else dynamic = true
      }
    }

    if (messages.length === 0) {
      // bare positional / chained (.complete(prompt)/generateContent(x)/.user(x)) — try arg 0,
      // but NOT a `key=value` kwarg (e.g. `ChatOpenAI(model=…)`) — those go through the keyed scan.
      const arg0 = callArgs(window)[0]
      const text = arg0 && !/^[\w$]+\s*[=:]/.test(arg0) ? resolveArg(arg0) : null
      if (text) messages.push({ role: 'system', content: text })
      else {
        dynamic = true
        continue // nothing resolvable at this site; skip rather than emit an empty prompt
      }
    }

    // Identity = where the prompt is defined (a resolved const), else the call site + enclosing symbol.
    const def = resolved.def
    const symbol =
      def?.name ?? enclosingSymbol(lines, idx) ?? basename(site.file, extname(site.file))
    const filePath = def?.file ?? site.file
    const line = def?.line ?? site.line
    const fingerprint = `${filePath}:${symbol}`
    if (seen.has(fingerprint)) continue
    seen.add(fingerprint)

    const resolution: Resolution = dynamic ? (messages.length ? 'partial' : 'dynamic') : 'resolved'
    out.push({
      fingerprint,
      name: symbol,
      content: [],
      messages,
      provider,
      model,
      params,
      resolution,
      filePath,
      symbol,
      line,
    })
    onLog(`  ✓ ${fingerprint} [${provider ?? '?'}/${model ?? 'no-model'}] ${resolution}`)
  }

  return out
}
