import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { McpCasesFile, type McpCase, type McpToolSurface } from '@echostash/shared'

export function readCasesFile(path: string, surface?: McpToolSurface): McpCasesFile {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch (err) {
    throw new Error(`could not read MCP cases file at ${path}: ${(err as Error).message}`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new Error(`corrupt JSON in MCP cases file at ${path}: ${(err as Error).message}`)
  }

  const file = McpCasesFile.parse(parsed)

  if (surface) {
    const knownTools = new Set(surface.tools.map((t) => t.name))
    for (const c of file.cases) {
      if (c.expectTool !== null && !knownTools.has(c.expectTool)) {
        throw new Error(
          `invalid case "${c.id}": expectTool "${c.expectTool}" does not exist on server "${surface.serverId}"`,
        )
      }
    }
  }

  return file
}

export function writeCasesFile(path: string, data: McpCasesFile): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

export function addCase(
  existing: McpCasesFile | null,
  server: string,
  newCase: Omit<McpCase, 'id'> & { id?: string },
  surface?: McpToolSurface,
): McpCasesFile {
  const file: McpCasesFile = existing ?? { server, cases: [] }
  if (surface && newCase.expectTool !== null) {
    const knownTools = new Set(surface.tools.map((t) => t.name))
    if (!knownTools.has(newCase.expectTool)) {
      throw new Error(
        `cannot add case: expectTool "${newCase.expectTool}" does not exist on server "${surface.serverId}"`,
      )
    }
  }

  const id = newCase.id ?? `c${file.cases.length + 1}`
  const entry: McpCase = {
    id,
    query: newCase.query,
    expectTool: newCase.expectTool,
    source: newCase.source ?? 'manual',
    notes: newCase.notes,
  }

  return {
    ...file,
    cases: [...file.cases.filter((c) => c.id !== id), entry],
  }
}
