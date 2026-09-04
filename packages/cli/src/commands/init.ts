import { loadConfig, saveConfig, CONFIG_FILENAME } from '../config'
import type { EchostashConfig } from '@echostash/shared'

const log = (m: string) => console.log(m)

interface InitFlags {
  yes: boolean
  url?: string
  apiKey?: string
  project?: string
  source?: string
}

function parseInitFlags(argv: string[]): InitFlags {
  const f: InitFlags = { yes: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '-y' || a === '--yes') f.yes = true
    else if (a === '--url') f.url = argv[++i]
    else if (a === '--api-key') f.apiKey = argv[++i]
    else if (a === '--project') f.project = argv[++i]
    else if (a === '--source') f.source = argv[++i]
  }
  return f
}

export async function runInit(argv: string[]): Promise<number> {
  const flags = parseInitFlags(argv)

  const existing = loadConfig()
  const url = flags.url ?? process.env.ECHOSTASH_URL ?? existing?.url ?? 'http://localhost:8080'
  const apiKey = flags.apiKey ?? process.env.ECHOSTASH_API_KEY ?? existing?.apiKey
  const project = flags.project ?? process.env.ECHOSTASH_PROJECT ?? existing?.project
  const source = flags.source ?? process.env.ECHOSTASH_SOURCE ?? existing?.source

  const config: EchostashConfig = {
    url,
    ...(apiKey ? { apiKey } : {}),
    ...(project ? { project } : {}),
    ...(source ? { source } : {}),
  }

  saveConfig(config)
  log(`✓ Configured Echostash target:`)
  log(`  Server URL: ${config.url}`)
  if (config.apiKey) log(`  API Key:    ${config.apiKey.slice(0, 8)}... (configured)`)
  else log(`  API Key:    (none — obtain from Settings → API keys in the UI)`)
  if (config.project) log(`  Project:    ${config.project}`)
  if (config.source) log(`  Source:     ${config.source}`)
  log(`✓ Saved configuration to ${CONFIG_FILENAME}`)

  return 0
}
