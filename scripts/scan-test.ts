/**
 * Manual scan harness — point the FULL analyzer pipeline at any project on disk.
 *
 *   1. cp scan-test.example scan-test.local   (scan-test.local is gitignored)
 *   2. edit scan-test.local: set PROJECT_PATH, and ECHOSTASH_SCAN_MODEL (+ creds) for the LLM phase
 *   3. pnpm scan:test
 *
 * Deterministic-only run: leave ECHOSTASH_SCAN_MODEL empty (or set NO_LLM=1).
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { scanReport } from '@echostash/analyzer'
import { makeClassifier } from '@echostash/cli'

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

  const projectPath = process.env.PROJECT_PATH
  if (!projectPath) {
    const where = loaded ? `(read ${envFile})` : `(no ${envFile} found)`
    console.error(
      `No PROJECT_PATH set. ${where}\nCopy scan-test.example to scan-test.local and set PROJECT_PATH.`,
    )
    process.exit(1)
  }

  const root = resolve(projectPath)
  const model = process.env.ECHOSTASH_SCAN_MODEL
  const useLlm = !process.env.NO_LLM && Boolean(model)
  const classifier = useLlm ? makeClassifier() : undefined

  console.log(`\nScanning ${root}`)
  console.log(useLlm ? `LLM phase: ${model}` : 'LLM phase: off (deterministic only)')

  const started = Date.now()
  const report = await scanReport({ root, classifier })
  const ms = Date.now() - started

  const classified = useLlm ? ` → ${report.stats.classifiedIn} classified` : ''
  console.log(
    `\n${report.stats.files} files · ${report.stats.definite} definite · ${report.stats.candidates} gray candidate(s)${classified}  (${ms}ms)`,
  )
  if (report.libraries.length) console.log(`libraries: ${report.libraries.join(', ')}`)

  console.log(`\nFound ${report.prompts.length} prompt(s):\n`)
  for (const p of report.prompts) {
    const modelLabel = p.model ? `${p.provider ?? '?'}/${p.model}` : 'no-model'
    const text = p.messages[0]?.content
    const preview = typeof text === 'string' ? text.replace(/\s+/g, ' ').slice(0, 120) : ''
    console.log(`  • ${p.fingerprint}  [${modelLabel}] (${p.resolution})`)
    if (preview) console.log(`      "${preview}${preview.length >= 120 ? '…' : ''}"`)
  }
  console.log('')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
