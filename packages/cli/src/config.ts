import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { EchostashConfig } from '@echostash/shared'

export const CONFIG_FILENAME = 'echostash.config.json'

export function loadConfig(dir: string = process.cwd()): EchostashConfig | null {
  const filePath = join(dir, CONFIG_FILENAME)
  if (!existsSync(filePath)) return null
  try {
    const raw = readFileSync(filePath, 'utf8')
    return EchostashConfig.parse(JSON.parse(raw))
  } catch {
    return null
  }
}

export function saveConfig(config: EchostashConfig, dir: string = process.cwd()): string {
  const filePath = join(dir, CONFIG_FILENAME)
  const data = JSON.stringify(config, null, 2) + '\n'
  writeFileSync(filePath, data, 'utf8')
  return filePath
}
