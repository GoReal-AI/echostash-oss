import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'

let cachedBin: string | undefined

/**
 * The ripgrep binary to run: the bundled one when `@vscode/ripgrep` is present, otherwise a
 * system `rg`.
 *
 * Resolved lazily via `createRequire` rather than a static import, because `@vscode/ripgrep`
 * is an *optional* dependency of the published CLI — it downloads a platform binary in a
 * postinstall hook, which can fail behind a proxy or in air-gapped CI. Under a static import
 * that failure would be fatal at startup for every command, including `mcp audit`, which
 * never touches ripgrep.
 */
export function rgBin(): string {
  if (cachedBin) return cachedBin
  try {
    const { rgPath } = createRequire(import.meta.url)('@vscode/ripgrep') as { rgPath?: string }
    if (rgPath && existsSync(rgPath)) {
      cachedBin = rgPath
      return cachedBin
    }
  } catch {
    // Not installed — fall through to whatever `rg` is on PATH.
  }
  cachedBin = 'rg'
  return cachedBin
}

export const COMMON_EXCLUDES = ['-g', '!node_modules', '-g', '!dist', '-g', '!build', '-g', '!.git']

/**
 * Run ripgrep under `root` and return matching lines (without the `./` path prefix).
 * Status 1 = "no matches", returned as []. An explicit `.` path is always appended so ripgrep
 * searches the directory rather than reading from a (non-TTY) stdin.
 */
export function rg(args: string[], root: string): string[] {
  try {
    return execFileSync(rgBin(), [...args, '.'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 32 << 20,
    })
      .split('\n')
      .filter(Boolean)
      .map((l) => (l.startsWith('./') ? l.slice(2) : l))
  } catch (err) {
    if ((err as { status?: number }).status === 1) return [] // no matches
    if ((err as { code?: string }).code === 'ENOENT') {
      throw new Error(
        'ripgrep not found. `scan` needs it, but it is an optional dependency — either reinstall ' +
          'without `--no-optional`, or install ripgrep yourself so `rg` is on PATH ' +
          '(https://github.com/BurntSushi/ripgrep#installation).',
        { cause: err },
      )
    }
    throw err
  }
}

/** List files under `root` matching the given globs (each glob passed as `-g <glob>`). */
export function rgFiles(globs: string[], root: string): string[] {
  const args = ['--files', ...globs.flatMap((g) => ['-g', g]), ...COMMON_EXCLUDES]
  return rg(args, root)
}
