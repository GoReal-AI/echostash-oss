/**
 * Manual scan harness — run the full scan + change-tracking against any project on disk.
 *
 *   1. cp scan-test.example scan-test.local      (scan-test.local is gitignored)
 *   2. edit scan-test.local: set PROJECT_PATH, and ECHOSTASH_SCAN_MODEL (+ creds) for the agent
 *   3. pnpm scan:test          (re-run after edits — it only re-scans what changed)
 *
 * With a model set it runs the agentic, language-agnostic scan; without one (or NO_LLM=1) it
 * runs the deterministic scan. Either way it tracks changes in <project>/.echostash/.
 */
import { existsSync, readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { runScan } from '@echostash/cli'

/** Load a KEY=VALUE file into process.env (does not override already-set vars). */
function loadEnvFile(path: string): boolean {
  if (!existsSync(path)) return false
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
  return true
}

async function main(): Promise<void> {
  const envFile = process.argv[2] ?? 'scan-test.local'
  const loaded = loadEnvFile(resolve(envFile))

  const project = process.env.PROJECT_PATH
  if (!project) {
    const where = loaded ? `(read ${envFile})` : `(no ${envFile} found)`
    console.error(
      `No PROJECT_PATH set ${where}.\nCopy scan-test.example to scan-test.local and set PROJECT_PATH.`,
    )
    process.exit(1)
  }

  const root = resolve(project)
  const useAgent = !process.env.NO_LLM && Boolean(process.env.ECHOSTASH_SCAN_MODEL)
  const argv = [
    root,
    '--track',
    '--dry-run',
    '--source',
    basename(root),
    ...(useAgent ? ['--agent'] : ['--no-llm']),
  ]
  process.exit(await runScan(argv))
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
