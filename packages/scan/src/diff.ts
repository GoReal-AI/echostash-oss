import type { ChangeStatus, Changeset, Manifest, PromptChange } from './types'

/**
 * Compare a freshly-built manifest against the previously stored one. Pure & deterministic.
 *
 *   file not seen before        → its prompts are `new`
 *   file gone on disk           → its prompts are `deleted`
 *   fileHash unchanged          → its prompts are `unchanged`
 *   fileHash changed            → compare promptHash per (path, name): new / modified / unchanged
 *                                 + any prompt in prev but not now → `deleted`
 */
export function diffManifests(prev: Manifest | null, current: Manifest): Changeset {
  const changes: PromptChange[] = []
  const prevFiles = prev?.files ?? {}
  const curFiles = current.files

  for (const [relPath, file] of Object.entries(curFiles)) {
    const prevFile = prevFiles[relPath]

    if (!prevFile) {
      for (const p of file.prompts) {
        changes.push({ relPath, name: p.name, status: 'new', promptHash: p.promptHash })
      }
      continue
    }

    if (prevFile.fileHash === file.fileHash) {
      for (const p of file.prompts) {
        changes.push({ relPath, name: p.name, status: 'unchanged', promptHash: p.promptHash })
      }
      continue
    }

    const prevByName = new Map(prevFile.prompts.map((p) => [p.name, p]))
    const curNames = new Set(file.prompts.map((p) => p.name))
    for (const p of file.prompts) {
      const before = prevByName.get(p.name)
      const status: ChangeStatus = !before
        ? 'new'
        : before.promptHash !== p.promptHash
          ? 'modified'
          : 'unchanged'
      changes.push({ relPath, name: p.name, status, promptHash: p.promptHash })
    }
    for (const p of prevFile.prompts) {
      if (!curNames.has(p.name)) {
        changes.push({ relPath, name: p.name, status: 'deleted', promptHash: null })
      }
    }
  }

  for (const [relPath, file] of Object.entries(prevFiles)) {
    if (!curFiles[relPath]) {
      for (const p of file.prompts) {
        changes.push({ relPath, name: p.name, status: 'deleted', promptHash: null })
      }
    }
  }

  const summary: Record<ChangeStatus, number> = { new: 0, modified: 0, deleted: 0, unchanged: 0 }
  for (const c of changes) summary[c.status]++

  return {
    source: current.source,
    changes,
    summary,
    filesScanned: Object.keys(curFiles).length,
    filesSkipped: 0,
  }
}
