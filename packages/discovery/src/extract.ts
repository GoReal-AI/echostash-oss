import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DiscoveredPrompt } from '@echostash/shared'
import type { PromptLocation } from './tools'

/**
 * Extract the verbatim prompt text from disk at each reported location — deterministic, and the
 * reason the agent only ever returns locations (no token cost / non-determinism from prompt bodies).
 * Whole-file prompts are exact; inline prompts use the reported line range.
 */
export function extractLocations(root: string, locations: PromptLocation[]): DiscoveredPrompt[] {
  const out: DiscoveredPrompt[] = []
  const seen = new Set<string>()

  for (const loc of locations) {
    let text: string
    try {
      const content = readFileSync(join(root, loc.file), 'utf8')
      if (loc.kind === 'file') {
        text = content
      } else {
        const lines = content.split('\n')
        const from = Math.max(0, (loc.fromLine ?? 1) - 1)
        const to = loc.toLine ?? Math.min(lines.length, from + 60)
        text = lines.slice(from, to).join('\n')
      }
    } catch {
      continue
    }
    text = text.trim()
    if (!text) continue

    const fingerprint = `${loc.file}:${loc.name}`
    if (seen.has(fingerprint)) continue
    seen.add(fingerprint)

    out.push({
      fingerprint,
      name: loc.name,
      content: [],
      messages: [{ role: 'system', content: text }],
      provider: null,
      model: null,
      params: {},
      resolution: 'resolved',
      filePath: loc.file,
      symbol: loc.kind === 'inline' ? loc.name : null,
      line: loc.fromLine ?? null,
    })
  }
  return out
}
