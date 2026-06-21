import type { TokenUsage } from '@echostash/llm'

/** USD per 1M tokens, {input, output}. Approximate list prices for the models we ship in the catalog. */
interface Rate {
  in: number
  out: number
}

const PRICING: Record<string, Rate> = {
  // OpenAI
  'gpt-4o': { in: 2.5, out: 10 },
  'gpt-4o-mini': { in: 0.15, out: 0.6 },
  'gpt-4.1': { in: 2, out: 8 },
  'gpt-4.1-mini': { in: 0.4, out: 1.6 },
  'o3-mini': { in: 1.1, out: 4.4 },
  // Anthropic
  'claude-3-5-sonnet': { in: 3, out: 15 },
  'claude-3-5-haiku': { in: 0.8, out: 4 },
  'claude-3-opus': { in: 15, out: 75 },
  'claude-sonnet-4': { in: 3, out: 15 },
  'claude-haiku-4': { in: 1, out: 5 },
  // Google
  'gemini-1.5-flash': { in: 0.075, out: 0.3 },
  'gemini-1.5-pro': { in: 1.25, out: 5 },
  'gemini-2.0-flash': { in: 0.1, out: 0.4 },
  'gemini-2.5-flash': { in: 0.3, out: 2.5 },
  'gemini-2.5-pro': { in: 1.25, out: 10 },
}

/** Longest-prefix match so e.g. `gpt-4o-2024-08-06` resolves to `gpt-4o`. */
function rateFor(model: string): Rate | null {
  const m = model.toLowerCase()
  let best: { key: string; rate: Rate } | null = null
  for (const [key, rate] of Object.entries(PRICING)) {
    if (m.includes(key) && (!best || key.length > best.key.length)) best = { key, rate }
  }
  return best?.rate ?? null
}

/** Cost of one call in USD, or `null` for an unpriced model (logged once by the caller). */
export function costUsd(model: string, usage: TokenUsage): number | null {
  const rate = rateFor(model)
  if (!rate) return null
  return (usage.promptTokens / 1e6) * rate.in + (usage.completionTokens / 1e6) * rate.out
}

/** Whether we have a price for this model (so callers can warn on misses). */
export const isPriced = (model: string): boolean => rateFor(model) !== null
