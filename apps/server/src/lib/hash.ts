import { createHash } from 'node:crypto'

/** Recursively sort object keys so equal values stringify identically. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(obj).sort()) out[key] = canonical(obj[key])
    return out
  }
  return value
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(canonical(value))
}

export function sha256(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex')
}
