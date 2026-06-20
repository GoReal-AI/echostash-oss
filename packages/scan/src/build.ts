import { sha256 } from './hash'
import type { FileEntry, Manifest, PromptEntry } from './types'

export interface ScanInputFile {
  relPath: string
  /** raw bytes of the file (read lazily so unchanged files are never read twice) */
  bytes: () => Buffer
}

export interface BuildOptions {
  source: string
  files: ScanInputFile[]
  /** Extract prompts from a (changed/new) file. Only called when the fileHash differs. */
  extract: (relPath: string) => Promise<PromptEntry[]> | PromptEntry[]
  prev: Manifest | null
}

/**
 * Build the current manifest. Files whose `fileHash` matches the previous manifest are
 * carried forward verbatim — `extract` (the LLM/agent or the deterministic parser) is
 * only invoked for new or changed files. This is the scalability lever.
 */
export async function buildManifest(
  opts: BuildOptions,
): Promise<{ manifest: Manifest; filesSkipped: number }> {
  const files: Record<string, FileEntry> = {}
  let filesSkipped = 0

  for (const f of opts.files) {
    const fileHash = sha256(f.bytes())
    const prevFile = opts.prev?.files[f.relPath]
    if (prevFile && prevFile.fileHash === fileHash) {
      files[f.relPath] = { relPath: f.relPath, fileHash, prompts: prevFile.prompts }
      filesSkipped++
      continue
    }
    const prompts = await opts.extract(f.relPath)
    files[f.relPath] = { relPath: f.relPath, fileHash, prompts }
  }

  return { manifest: { source: opts.source, files }, filesSkipped }
}
