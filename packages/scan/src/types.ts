/** One prompt's record inside a file. `name` is its anchor within the file. */
export interface PromptEntry {
  name: string
  promptHash: string
  line?: number | null
  model?: string | null
}

/** One file's record: its content hash + the prompts found in it. */
export interface FileEntry {
  relPath: string
  fileHash: string
  prompts: PromptEntry[]
}

/** The recorded state of a source after a scan. Keyed by relative path. */
export interface Manifest {
  source: string
  files: Record<string, FileEntry>
}

export type ChangeStatus = 'new' | 'modified' | 'deleted' | 'unchanged'

export interface PromptChange {
  relPath: string
  name: string
  status: ChangeStatus
  /** null for deleted */
  promptHash: string | null
}

export interface Changeset {
  source: string
  changes: PromptChange[]
  summary: Record<ChangeStatus, number>
  filesScanned: number
  /** files skipped because their fileHash matched the previous manifest (never re-read) */
  filesSkipped: number
}

/** Pluggable persistence for the manifest + changeset. Lets prompts live in Echostash,
 *  a local file, the user's own DB — or several at once (a composite store). */
export interface Store {
  load(source: string): Promise<Manifest | null>
  save(source: string, manifest: Manifest, changeset: Changeset): Promise<void>
}
