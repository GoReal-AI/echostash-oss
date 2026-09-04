import { describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadConfig, saveConfig, CONFIG_FILENAME } from '../src/config'

describe('CLI config', () => {
  it('saves and loads echostash.config.json with round-trip fidelity', () => {
    const dir = mkdtempSync(join(tmpdir(), 'echostash-config-test-'))

    const initial = loadConfig(dir)
    expect(initial).toBeNull()

    const config = {
      url: 'https://custom.echostash.io',
      apiKey: 'echo_sec_1234567890abcdef',
      project: 'my-agent-core',
      source: 'backend-api',
    }

    saveConfig(config, dir)
    const loaded = loadConfig(dir)
    expect(loaded).toEqual(config)

    rmSync(dir, { recursive: true, force: true })
  })

  it('supplies default URL when partial config is provided', () => {
    const dir = mkdtempSync(join(tmpdir(), 'echostash-config-test-'))

    saveConfig({ project: 'test-proj' } as any, dir)
    const loaded = loadConfig(dir)
    expect(loaded?.url).toBe('http://localhost:8080')
    expect(loaded?.project).toBe('test-proj')

    rmSync(dir, { recursive: true, force: true })
  })
})
