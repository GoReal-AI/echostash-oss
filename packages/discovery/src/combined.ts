import type { DiscoveredPrompt } from '@echostash/shared'
import { type AnchoredOptions, anchoredDiscover } from './anchored'
import { ripgrepDiscover } from './ripgrep'

export interface DiscoverPromptsOptions extends AnchoredOptions {
  /** Skip the content-signal fallback (call-site evidence only). */
  noFallback?: boolean
}

/** Normalised content signature so a prompt found both ways (call site + named const) dedupes. */
const signature = (p: DiscoveredPrompt): string =>
  p.messages
    .map((m) => m.content)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)

/**
 * Usage-anchored discovery with a content-signal fallback — the deterministic default scan.
 *
 *  1. anchored: prompts that demonstrably flow into an LLM call (catalog + structural + custom shapes)
 *  2. fallback: dedicated prompt files + strongly-evidenced prompt strings the data-flow couldn't reach
 *
 * Layer 2 is merged only for prompts layer 1 didn't already cover (by content + by location).
 */
export function discoverPrompts(
  root: string,
  opts: DiscoverPromptsOptions = {},
): DiscoveredPrompt[] {
  const onLog = opts.onLog ?? (() => {})

  onLog('▸ usage-anchored pass (prompts that reach an LLM call)')
  const anchored = anchoredDiscover(root, opts)

  if (opts.noFallback) return anchored

  const sigs = new Set(anchored.map(signature))
  const fps = new Set(anchored.map((p) => p.fingerprint))

  onLog('▸ fallback pass (dedicated files + strong prompt strings)')
  const fallback = ripgrepDiscover(root, { onLog }).filter((p) => {
    if (fps.has(p.fingerprint) || sigs.has(signature(p))) return false
    fps.add(p.fingerprint)
    sigs.add(signature(p))
    return true
  })

  onLog(`= ${anchored.length} anchored + ${fallback.length} fallback`)
  return [...anchored, ...fallback]
}
