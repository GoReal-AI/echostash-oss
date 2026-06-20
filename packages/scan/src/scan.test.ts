import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { buildManifest } from './build'
import { diffManifests } from './diff'
import { LocalStore } from './store'
import type { Manifest, PromptEntry } from './types'

const file = (relPath: string, fileHash: string, prompts: PromptEntry[]) => ({
  relPath,
  fileHash,
  prompts,
})
const manifest = (files: ReturnType<typeof file>[]): Manifest => ({
  source: 's',
  files: Object.fromEntries(files.map((f) => [f.relPath, f])),
})

describe('diffManifests', () => {
  it('flags new / modified / deleted / unchanged', () => {
    const prev = manifest([
      file('a.ts', 'fa1', [{ name: 'p', promptHash: 'h1' }]),
      file('b.ts', 'fb1', [{ name: 'q', promptHash: 'h2' }]),
      file('gone.ts', 'fg1', [{ name: 'r', promptHash: 'h3' }]),
    ])
    const cur = manifest([
      file('a.ts', 'fa1', [{ name: 'p', promptHash: 'h1' }]), // unchanged (same fileHash)
      file('b.ts', 'fb2', [{ name: 'q', promptHash: 'h2-new' }]), // file + prompt changed
      file('c.ts', 'fc1', [{ name: 's', promptHash: 'h4' }]), // new file
    ])
    const cs = diffManifests(prev, cur)
    const byName = Object.fromEntries(cs.changes.map((c) => [c.name, c.status]))
    expect(byName).toEqual({ p: 'unchanged', q: 'modified', s: 'new', r: 'deleted' })
    expect(cs.summary).toEqual({ new: 1, modified: 1, deleted: 1, unchanged: 1 })
  })

  it('everything is new against an empty/null prev', () => {
    const cs = diffManifests(null, manifest([file('a.ts', 'fa', [{ name: 'p', promptHash: 'h' }])]))
    expect(cs.summary.new).toBe(1)
  })
})

describe('buildManifest', () => {
  it('skips extraction for files whose fileHash is unchanged', async () => {
    const bytes = () => Buffer.from('same content')
    const prev = manifest([
      // sha256('same content') — precomputed below by building once
    ])
    // first build (no prev) extracts
    const extract = vi.fn(async () => [{ name: 'p', promptHash: 'h' }])
    const first = await buildManifest({
      source: 's',
      files: [{ relPath: 'a.ts', bytes }],
      extract,
      prev: null,
    })
    expect(extract).toHaveBeenCalledTimes(1)

    // second build with the first manifest as prev + identical bytes → no extraction
    const extract2 = vi.fn(async () => [{ name: 'p', promptHash: 'h' }])
    const second = await buildManifest({
      source: 's',
      files: [{ relPath: 'a.ts', bytes }],
      extract: extract2,
      prev: first.manifest,
    })
    expect(extract2).not.toHaveBeenCalled()
    expect(second.filesSkipped).toBe(1)
    expect(second.manifest.files['a.ts']?.prompts).toEqual([{ name: 'p', promptHash: 'h' }])
    void prev
  })
})

describe('LocalStore', () => {
  const dir = mkdtempSync(join(tmpdir(), 'echo-scan-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('round-trips a manifest', async () => {
    const store = new LocalStore(dir)
    expect(await store.load('demo')).toBeNull()
    const m = manifest([file('a.ts', 'fa', [{ name: 'p', promptHash: 'h' }])])
    await store.save('demo', m, diffManifests(null, m))
    const loaded = await store.load('demo')
    expect(loaded?.files['a.ts']?.fileHash).toBe('fa')
  })
})
