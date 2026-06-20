import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, join, resolve as resolvePath } from 'node:path'
import { extractStringAt } from './strings'

const CODE_EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.java', '.kt', '.go', '.rb']

const readSafe = (p: string): string | null => {
  try {
    return readFileSync(p, 'utf8')
  } catch {
    return null
  }
}

/** Find `name`'s definition in `lines` and return the string literal it's assigned. */
export function findDefinition(
  lines: string[],
  name: string,
): { text: string; fromLine: number } | null {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // `const NAME =`, `String NAME =`, `NAME =`, `NAME:` — then a string opener on the same line.
  const def = new RegExp(
    `(?:^|\\b)(?:const|let|var|val|final|String|String\\[\\])?\\s*${esc}\\s*[:=]`,
  )
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (!def.test(line)) continue
    const s = extractStringAt(lines, line, i)
    if (s?.text.trim()) return s
  }
  return null
}

/** Resolve `import { name } from './mod'` (JS/TS) or `from mod import name` (Py) to a file under root. */
function resolveImportFile(root: string, fromFile: string, name: string): string | null {
  const src = readSafe(join(root, fromFile))
  if (!src) return null
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // JS/TS: import { name } / import name from './mod'
  const js = src.match(
    new RegExp(`import\\s+(?:{[^}]*\\b${esc}\\b[^}]*}|${esc})\\s+from\\s+['"]([^'"]+)['"]`),
  )
  // Python: from pkg.mod import name
  const py = src.match(new RegExp(`from\\s+([\\w.]+)\\s+import\\s+(?:[^\\n]*\\b${esc}\\b)`))
  const baseDir = dirname(join(root, fromFile))
  if (js?.[1]?.startsWith('.')) {
    // ESM/TS imports often spell `./x.js` but the file on disk is `./x.ts`; strip the ext and probe.
    const spec = js[1].replace(/\.(jsx?|mjs|cjs)$/, '')
    const stem = resolvePath(baseDir, spec)
    for (const ext of [...CODE_EXT, '/index.ts', '/index.js']) {
      if (existsSync(stem + ext)) return stem + ext
    }
    if (existsSync(stem) && extname(stem)) return stem
  }
  if (py?.[1]) {
    const stem = resolvePath(baseDir, py[1].replace(/\./g, '/'))
    if (existsSync(`${stem}.py`)) return `${stem}.py`
  }
  return null
}

/** Trace identifier `name` to its string value: in-file first, then one import hop. */
export function resolveIdentifier(
  root: string,
  file: string,
  lines: string[],
  name: string,
): { text: string; fromLine: number; file: string } | null {
  const local = findDefinition(lines, name)
  if (local) return { ...local, file }
  const imported = resolveImportFile(root, file, name)
  if (imported) {
    const src = readSafe(imported)
    if (src) {
      const def = findDefinition(src.split('\n'), name)
      if (def) return { ...def, file: imported.slice(root.length + 1) }
    }
  }
  return null
}

const PROMPT_FILE_EXT = new Set([
  '.st',
  '.prompt',
  '.tmpl',
  '.hbs',
  '.j2',
  '.jinja',
  '.mustache',
  '.txt',
  '.md',
])

/**
 * If `expr` references a prompt resource file (a path literal passed to a read/resource call, or an
 * import of a template file), follow it and return the file's contents.
 */
export function followFileRead(
  root: string,
  file: string,
  expr: string,
): { text: string; path: string } | null {
  const pathLit = expr.match(/['"`]([^'"`]+\.(?:st|prompt|tmpl|hbs|j2|jinja|mustache|txt|md))['"`]/)
  if (!pathLit?.[1]) return null
  const rel = pathLit[1]
  // Try the path as-is (relative to file's dir, then root), then common resource roots.
  const candidates = [
    resolvePath(dirname(join(root, file)), rel),
    join(root, rel),
    join(root, 'src/main/resources', rel),
    join(root, 'resources', rel),
  ]
  for (const c of candidates) {
    if (existsSync(c) && PROMPT_FILE_EXT.has(extname(c))) {
      const text = readSafe(c)
      if (text?.trim()) return { text, path: c.slice(root.length + 1) }
    }
  }
  return null
}
