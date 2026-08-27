import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { CATALOG, type CallShape } from './catalog'
import { rg, rgFiles } from './rgexec'

const MANIFESTS = [
  'package.json',
  'requirements.txt',
  'pyproject.toml',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'go.mod',
  'Gemfile',
]

/** ripgrep signals for files likely to contain an LLM call or a wrapper around one. */
const WRAPPER_SIGNALS = [
  '\\b(complete|completion|chat|generate|invoke|ask|call)\\w*\\s*\\(',
  '\\b(llm|model|client)\\b',
  'systemPrompt|system_prompt|messages\\s*[:=]',
]

const Shape = z.object({
  id: z.string(),
  call: z.string(),
  promptArg: z.string().nullable().optional(),
  provider: z.enum(['openai', 'anthropic', 'google', 'vertex', 'litellm']).nullable().optional(),
})
type Shape = z.infer<typeof Shape>

/**
 * Salvage shape objects from a model response one-by-one. Resilient to a malformed array (a missing
 * comma between objects, a single bad shape) — we extract each leaf `{…}` block and parse it alone,
 * rather than letting one JSON slip discard the whole augment.
 */
function parseShapes(text: string): Shape[] {
  const body = text.replace(/```(?:json)?/gi, '')
  const blocks: string[] = []
  const stack: number[] = []
  let inStr: string | null = null
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (inStr) {
      if (ch === inStr && body[i - 1] !== '\\') inStr = null
      continue
    }
    if (ch === '"' || ch === "'") inStr = ch
    else if (ch === '{') stack.push(i)
    else if (ch === '}') {
      const open = stack.pop()
      if (open !== undefined) blocks.push(body.slice(open, i + 1))
    }
  }
  const shapes: Shape[] = []
  for (const block of blocks) {
    if (!block.includes('"call"') || (block.match(/{/g)?.length ?? 0) !== 1) continue // leaf shapes only
    try {
      const parsed = JSON.parse(block.replace(/,(\s*})/g, '$1'))
      const r = Shape.safeParse(parsed)
      if (r.success) shapes.push(r.data)
    } catch {
      // skip this malformed shape, keep the rest
    }
  }
  return shapes.slice(0, 12)
}

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}\n…(truncated)` : s)

const readSafe = (p: string): string | null => {
  try {
    return readFileSync(p, 'utf8')
  } catch {
    return null
  }
}

/** Gather a small, bounded context: manifests + a handful of representative source files. */
function gatherContext(root: string): string {
  const parts: string[] = []
  for (const m of MANIFESTS) {
    const text = readSafe(join(root, m))
    if (text) parts.push(`### ${m}\n${truncate(text, 1500)}`)
  }
  // Rank source files by signal density (`rg -c` → file:count) so the files with the most LLM-call
  // activity are shown to the model — that's where the real wrappers and prompt hand-offs live.
  const codeFiles = new Set(
    rgFiles(['*.ts', '*.js', '*.py', '*.java', '*.kt', '*.go', '*.rb'], root),
  )
  const counts = new Map<string, number>()
  const args = ['-c', '-i']
  for (const s of WRAPPER_SIGNALS) args.push('-e', s)
  for (const m of rg(args, root)) {
    const i = m.lastIndexOf(':')
    const file = m.slice(0, i)
    if (codeFiles.has(file)) counts.set(file, (counts.get(file) ?? 0) + Number(m.slice(i + 1) || 0))
  }
  const picked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  for (const [f] of picked) {
    const text = readSafe(join(root, f))
    if (text) parts.push(`### ${f}\n${truncate(text.split('\n').slice(0, 120).join('\n'), 2400)}`)
  }
  return parts.join('\n\n')
}

const SYSTEM = `You analyze a code repository to learn HOW it invokes an LLM, so a downstream
deterministic scanner can locate every prompt. The scanner already knows the standard SDK call
shapes; your job is to find PROJECT-SPECIFIC wrappers it would miss — a helper like
\`llmService.complete(prompt, cfg)\`, \`createAgent({ systemPrompt })\`, \`askModel(text)\`, etc.

For each distinct wrapper, return: a literal substring that appears at the call, which argument
carries the prompt (a 0-based positional index, or the key name for an object/kwarg), and the
provider it ultimately calls if you can tell. Only include wrappers that genuinely send text to an
LLM. Do NOT repeat the standard SDK shapes already known. Be precise; return few, high-quality shapes.

Respond with ONLY a JSON object, no prose and no markdown fences, of the form:
{"shapes":[{"id":"llmService.complete","call":".complete(","promptArg":"0","provider":"anthropic"}]}
"call" is a PLAIN LITERAL substring that appears verbatim at the call site (e.g. ".complete(" or
"llmService.chat(") — NOT a regex, no backslashes. Use null for provider when unknown. promptArg is
a string: a positional index like "0" or a key name like "systemPrompt". Return {"shapes":[]} if
there are no custom wrappers.`

export interface AugmentOptions {
  spec: string
  onLog?: (msg: string) => void
}

/**
 * One bounded LLM request that derives custom-wrapper call shapes for this project. Returned shapes
 * feed the deterministic anchored scan. Parsing is resilient (bad shapes are skipped); a model/network
 * failure throws — callers should degrade to the catalog-only scan.
 */
export async function augmentShapes(root: string, opts: AugmentOptions): Promise<CallShape[]> {
  const onLog = opts.onLog ?? (() => {})
  const known = CATALOG.flatMap((s) => s.patterns).join('\n')
  const context = gatherContext(root)
  if (!context.trim()) return []

  onLog(`augment: analyzing project with ${opts.spec}…`)
  // Imported lazily so the provider layer (and the ~10MB of AI SDKs behind it) is only loaded
  // when someone actually opts into `--scan-model`. Every other command pays nothing.
  const { generate } = await import('@echostash/llm')
  const text = await generate({
    spec: opts.spec,
    system: SYSTEM,
    prompt: `Standard call shapes already covered (do not repeat):\n${known}\n\nRepository: ${root}\n\n${context}`,
    // Generous budget: thinking models (e.g. gemini-2.5-flash) spend output tokens reasoning first.
    maxTokens: 4096,
  })
  const promptArgOf = (v: string | null | undefined): number | string | undefined => {
    if (v == null) return undefined
    return /^\d+$/.test(v.trim()) ? Number(v.trim()) : v
  }
  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const shapes: CallShape[] = parseShapes(text)
    .filter((s) => s.call.trim().length >= 3)
    .map((s) => ({
      id: `augment:${s.id}`,
      provider: s.provider ?? null,
      patterns: [escapeRe(s.call.trim())],
      promptArg: promptArgOf(s.promptArg),
      kind: 'sdk' as const,
    }))
  onLog(
    `augment: ${shapes.length} custom shape(s) — ${shapes.map((s) => s.id).join(', ') || 'none'}`,
  )
  return shapes
}
