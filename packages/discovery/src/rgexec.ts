import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { rgPath } from '@vscode/ripgrep'

/** Bundled ripgrep binary (ships with the tool) — falls back to a system `rg` if the bundle is absent. */
export const RG_BIN = rgPath && existsSync(rgPath) ? rgPath : 'rg'

export const COMMON_EXCLUDES = ['-g', '!node_modules', '-g', '!dist', '-g', '!build', '-g', '!.git']

/**
 * Run ripgrep under `root` and return matching lines (without the `./` path prefix).
 * Status 1 = "no matches", returned as []. An explicit `.` path is always appended so ripgrep
 * searches the directory rather than reading from a (non-TTY) stdin.
 */
export function rg(args: string[], root: string): string[] {
  try {
    return execFileSync(RG_BIN, [...args, '.'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 32 << 20,
    })
      .split('\n')
      .filter(Boolean)
      .map((l) => (l.startsWith('./') ? l.slice(2) : l))
  } catch (err) {
    if ((err as { status?: number }).status === 1) return [] // no matches
    throw err
  }
}

/** List files under `root` matching the given globs (each glob passed as `-g <glob>`). */
export function rgFiles(globs: string[], root: string): string[] {
  const args = ['--files', ...globs.flatMap((g) => ['-g', g]), ...COMMON_EXCLUDES]
  return rg(args, root)
}
