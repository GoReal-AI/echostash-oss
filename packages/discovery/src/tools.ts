import { execFileSync } from 'node:child_process'
import { type Dirent, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { type ToolSet, tool } from 'ai'
import { z } from 'zod'

export interface PromptLocation {
  file: string
  name: string
  kind: 'file' | 'inline'
  fromLine?: number
  toLine?: number
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.turbo', 'target', '.gradle'])

/** Resolve a (relative) path inside root; null if it escapes root. */
function safe(root: string, p: string): string | null {
  const abs = resolve(root, p)
  return abs === root || abs.startsWith(`${root}/`) ? abs : null
}

function treeOf(dir: string, depth: number, prefix: string, out: string[], cap: number): void {
  if (out.length >= cap || depth < 0) return
  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (out.length >= cap) return
    if (e.name.startsWith('.') && e.name !== '.echostash') continue
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue
      out.push(`${prefix}${e.name}/`)
      treeOf(join(dir, e.name), depth - 1, `${prefix}  `, out, cap)
    } else {
      out.push(`${prefix}${e.name}`)
    }
  }
}

/** Build the read-only toolset rooted at `root`; found prompts accumulate into `found`. */
export function makeTools(root: string, found: PromptLocation[]): ToolSet {
  return {
    tree: tool({
      description: 'List the directory structure (folders + files) under a path, to a small depth.',
      parameters: z.object({
        path: z.string().default('.').describe('relative path from the repo root'),
        depth: z.number().int().min(1).max(4).default(2),
      }),
      execute: async ({ path, depth }) => {
        const abs = safe(root, path)
        if (!abs) return 'error: path escapes the repository root'
        const out: string[] = []
        treeOf(abs, depth, '', out, 200)
        return out.length ? out.join('\n') : '(empty)'
      },
    }),

    grep: tool({
      description:
        'Search file contents with a regex (ripgrep). Returns up to a few matches per file as path:line:text.',
      parameters: z.object({
        pattern: z.string().describe('a regular expression'),
        glob: z
          .string()
          .optional()
          .describe("optional file glob, e.g. '*.java' or '**/prompts/**'"),
        ignoreCase: z.boolean().default(true),
      }),
      execute: async ({ pattern, glob, ignoreCase }) => {
        const args = ['-n', '--max-count', '4', '--max-columns', '200', '--no-heading']
        if (ignoreCase) args.push('-i')
        if (glob) args.push('-g', glob)
        args.push('-e', pattern, '.')
        try {
          const out = execFileSync('rg', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 20 })
          const lines = out.split('\n').filter(Boolean).slice(0, 80)
          return lines.length ? lines.join('\n') : '(no matches)'
        } catch (err) {
          // ripgrep exits 1 when there are no matches
          const e = err as { status?: number }
          if (e.status === 1) return '(no matches)'
          return `error: ${(err as Error).message}`
        }
      },
    }),

    read_file: tool({
      description: 'Read a file (optionally a line range). Output is capped.',
      parameters: z.object({
        path: z.string(),
        fromLine: z.number().int().min(1).optional(),
        toLine: z.number().int().min(1).optional(),
      }),
      execute: async ({ path, fromLine, toLine }) => {
        const abs = safe(root, path)
        if (!abs) return 'error: path escapes the repository root'
        try {
          if (statSync(abs).size > 512 * 1024) return 'error: file too large'
          const all = readFileSync(abs, 'utf8').split('\n')
          const start = fromLine ? fromLine - 1 : 0
          const end = toLine ?? Math.min(all.length, start + 250)
          return all.slice(start, end).join('\n').slice(0, 12_000)
        } catch (err) {
          return `error: ${(err as Error).message}`
        }
      },
    }),

    report_prompt: tool({
      description:
        'Record a prompt you found. Report the LOCATION only (do not paste the prompt text).',
      parameters: z.object({
        file: z.string().describe('relative path to the file containing the prompt'),
        name: z
          .string()
          .describe('a short stable name: the variable/const/field name, or the file base name'),
        kind: z
          .enum(['file', 'inline'])
          .describe("'file' if the whole file is a prompt, else 'inline'"),
        fromLine: z.number().int().min(1).optional().describe('first line, for inline prompts'),
        toLine: z.number().int().min(1).optional().describe('last line, for inline prompts'),
      }),
      execute: async ({ file, name, kind, fromLine, toLine }) => {
        const abs = safe(root, file)
        if (!abs) return 'error: path escapes the repository root'
        found.push({ file: relative(root, abs), name, kind, fromLine, toLine })
        return 'recorded'
      },
    }),
  }
}
