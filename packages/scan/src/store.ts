import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Changeset, Manifest, Store } from './types'

const slug = (s: string) => s.replace(/[^a-zA-Z0-9_-]+/g, '_')

/** Store the manifest as JSON on disk (default: `<dir>/manifest.<source>.json`). */
export class LocalStore implements Store {
  constructor(private readonly dir: string) {}

  private path(source: string): string {
    return join(this.dir, `manifest.${slug(source)}.json`)
  }

  async load(source: string): Promise<Manifest | null> {
    try {
      return JSON.parse(readFileSync(this.path(source), 'utf8')) as Manifest
    } catch {
      return null
    }
  }

  async save(source: string, manifest: Manifest, _changeset: Changeset): Promise<void> {
    mkdirSync(this.dir, { recursive: true })
    writeFileSync(this.path(source), JSON.stringify(manifest, null, 2))
  }
}

/**
 * Write to several stores at once ("all together"). Reads the previous manifest from the
 * first store that has one (stores are tried in order).
 */
export class CompositeStore implements Store {
  constructor(private readonly stores: Store[]) {}

  async load(source: string): Promise<Manifest | null> {
    for (const s of this.stores) {
      const m = await s.load(source)
      if (m) return m
    }
    return null
  }

  async save(source: string, manifest: Manifest, changeset: Changeset): Promise<void> {
    await Promise.all(this.stores.map((s) => s.save(source, manifest, changeset)))
  }
}
