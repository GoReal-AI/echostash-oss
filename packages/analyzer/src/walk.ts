import { readFileSync, readdirSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import ts from 'typescript'

const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
export const DEFAULT_EXCLUDE = ['node_modules', 'dist', '.git', '.turbo', 'coverage', 'build']

function scriptKind(file: string): ts.ScriptKind {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX
  if (file.endsWith('.jsx')) return ts.ScriptKind.JSX
  if (file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.cjs'))
    return ts.ScriptKind.JS
  return ts.ScriptKind.TS
}

export function listSourceFiles(root: string, exclude: string[]): string[] {
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

export function parseFile(absPath: string, relPath: string): ts.SourceFile | null {
  let text: string
  try {
    text = readFileSync(absPath, 'utf8')
  } catch {
    return null
  }
  return ts.createSourceFile(relPath, text, ts.ScriptTarget.Latest, true, scriptKind(absPath))
}
