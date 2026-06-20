import { readFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import type { DiscoveredPrompt } from '@echostash/shared'
import { COMMON_EXCLUDES, rg } from './rgexec'
import { extractEnclosingString } from './strings'

/** Dedicated prompt-file shapes — the whole file is the prompt. */
const PROMPT_FILE_GLOBS = [
  '**/prompts/**',
  '*.st',
  '*.prompt',
  '*.tmpl',
  '*.hbs',
  '*.j2',
  '*.jinja',
  '*.mustache',
]
const NONCODE_PROMPT_EXT = new Set([
  '.st',
  '.prompt',
  '.tmpl',
  '.hbs',
  '.j2',
  '.jinja',
  '.mustache',
  '.txt',
])

/** Content + name signals that mark a string as addressed to an LLM (any language). */
const CONTENT_SIGNALS = [
  'you are (a|an|the|now|here|responsible|tasked)',
  'your (role|task|job|goal|mission|purpose) (is|:)',
  'you (must|should|always|never|will) ',
  'respond (with|only|in|using)',
  'reply (with|only|in)',
  'act as (a|an|the)',
  '\\[#(role|system|tool|skill)',
  'system prompt',
]
const NAME_SIGNALS = [
  '(SYSTEM_|USER_|ASSISTANT_)?PROMPT\\s*[:=]',
  'systemPrompt\\s*[:=]',
  'instructions?\\s*[:=]\\s*[`"\']',
  'persona\\s*[:=]\\s*[`"\']',
  'rubric\\s*[:=]\\s*[`"\']',
]

/** A name that itself signals a prompt (variable/const named like a prompt). */
const isPromptName = (name: string): boolean =>
  /prompt|template|instruction|persona|rubric|system|preamble|directive/i.test(name)

/** Strong textual evidence that a string is genuinely an LLM instruction (not just mentions one). */
const hasStrongEvidence = (text: string): boolean =>
  /\[#(role|system|tool|skill)\s/i.test(text) ||
  /^\s*(you are|you're|act as|your (?:role|task|job|goal|mission)|you (?:must|should|always|never)|respond (?:with|only|in)|reply (?:with|only|in))/i.test(
    text,
  )

/** Looks like a code fragment / regex / log string the signal scan grabbed by accident, not a prompt. */
const looksLikeCode = (text: string): boolean =>
  /^[;,.{}()=<>+*/&|\\?:]/.test(text.trim()) ||
  /\b(function|return|const|let|var|=>|StringUtils|System\.out|console\.|println)\b/.test(
    text.slice(0, 48),
  ) ||
  /\\[sdwSDWbn[\]]|\[#(role|system|user|assistant)\\/i.test(text.slice(0, 24))

function filePrompt(file: string, name: string, text: string): DiscoveredPrompt {
  return {
    fingerprint: `${file}:${name}`,
    name,
    content: [],
    messages: [{ role: 'system', content: text }],
    provider: null,
    model: null,
    params: {},
    resolution: 'resolved',
    filePath: file,
    symbol: null,
    line: null,
  }
}

export interface RipgrepOptions {
  onLog?: (msg: string) => void
}

/**
 * Deterministic, language-agnostic discovery: ripgrep locates prompts (dedicated files + content
 * /name signals across any language), we extract the verbatim string. Fast (~ms) and observable.
 */
export function ripgrepDiscover(root: string, opts: RipgrepOptions = {}): DiscoveredPrompt[] {
  const onLog = opts.onLog ?? (() => {})
  const out: DiscoveredPrompt[] = []
  const seen = new Set<string>()
  const add = (p: DiscoveredPrompt) => {
    if (seen.has(p.fingerprint)) return
    seen.add(p.fingerprint)
    out.push(p)
    onLog(`  ✓ ${p.fingerprint}`)
  }

  // 1. dedicated prompt files (whole-file)
  const fileGlobs = PROMPT_FILE_GLOBS.flatMap((g) => ['-g', g])
  const promptFiles = rg(['--files', ...fileGlobs, ...COMMON_EXCLUDES], root)
  onLog(`prompt-file globs → ${promptFiles.length} file(s)`)
  for (const f of promptFiles) {
    if (!NONCODE_PROMPT_EXT.has(extname(f)) && extname(f) !== '.md') continue
    try {
      const text = readFileSync(join(root, f), 'utf8').trim()
      if (text.length >= 20) add(filePrompt(f, basename(f), text))
    } catch {
      // unreadable
    }
  }

  // 2. content + name signals in code → extract the enclosing string literal
  const args = ['-n', '--no-heading', '-i', ...COMMON_EXCLUDES, '-g', '!*.test.*']
  for (const s of [...CONTENT_SIGNALS, ...NAME_SIGNALS]) args.push('-e', s)
  const matches = rg(args, root)

  const byFile = new Map<string, Set<number>>()
  for (const m of matches) {
    const firstColon = m.indexOf(':')
    const secondColon = m.indexOf(':', firstColon + 1)
    if (firstColon === -1 || secondColon === -1) continue
    const file = m.slice(0, firstColon)
    const line = Number(m.slice(firstColon + 1, secondColon))
    if (!line || NONCODE_PROMPT_EXT.has(extname(file)) || extname(file) === '.md') continue
    const set = byFile.get(file) ?? new Set<number>()
    set.add(line)
    byFile.set(file, set)
  }
  onLog(`content/name signals → ${byFile.size} code file(s) to inspect`)

  for (const [file, lineNums] of byFile) {
    let content: string
    try {
      content = readFileSync(join(root, file), 'utf8')
    } catch {
      continue
    }
    for (const line of lineNums) {
      const ext = extractEnclosingString(content, line)
      const text = ext?.text.trim() ?? ''
      if (!ext || text.length < 30 || looksLikeCode(text)) continue
      // The signal must sit INSIDE the extracted string (not a nearby comment / unrelated literal).
      const endLine = ext.fromLine + ext.text.split('\n').length - 1
      if (line > endLine) continue
      // Keep only a real prompt-named variable, or a string with strong instruction evidence —
      // a filename-derived name does not count (avoids labelling code fragments by their file).
      const named = ext.name ? isPromptName(ext.name) : false
      if (!named && !hasStrongEvidence(text)) continue
      const name = ext.name ?? basename(file, extname(file))
      add({
        fingerprint: `${file}:${name}`,
        name,
        content: [],
        messages: [{ role: 'system', content: text }],
        provider: null,
        model: null,
        params: {},
        resolution: 'resolved',
        filePath: file,
        symbol: name,
        line: ext.fromLine,
      })
    }
  }

  return out
}
