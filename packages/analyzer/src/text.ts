/**
 * Deterministic text utilities. No embeddings, no model calls — the whole point of the v0
 * analyzer is that it runs with no API key, offline, and gives the same answer every time.
 */

/** Rough token estimate. ~4 chars/token is the usual English approximation. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'this',
  'to',
  'use',
  'used',
  'using',
  'with',
  'you',
  'your',
])

/** Content words only — stopwords carry no signal about what a tool actually does. */
export function contentWords(text: string): Set<string> {
  return new Set(
    normalize(text)
      .split(' ')
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  )
}

/** Jaccard overlap of two sets, 0..1. */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  let shared = 0
  for (const x of a) if (b.has(x)) shared++
  const union = a.size + b.size - shared
  return union === 0 ? 0 : shared / union
}

/** Character trigrams — catches shared phrasing that word overlap alone misses. */
export function trigrams(text: string): Set<string> {
  const s = ` ${normalize(text)} `
  const out = new Set<string>()
  for (let i = 0; i + 3 <= s.length; i++) out.add(s.slice(i, i + 3))
  return out
}

/** Levenshtein distance, iterative two-row. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  // Single rolling row: `diag` carries the previous row's j-1 cell, so we never index twice.
  const row: number[] = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = row[0] ?? 0
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const up = row[j] ?? 0
      const left = row[j - 1] ?? 0
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      row[j] = Math.min(left + 1, up + 1, diag + cost)
      diag = up
    }
  }
  return row[b.length] ?? 0
}

/** Name similarity 0..1 — 1 is identical. */
export function nameSimilarity(a: string, b: string): number {
  const an = normalize(a.replace(/[_-]+/g, ' '))
  const bn = normalize(b.replace(/[_-]+/g, ' '))
  const max = Math.max(an.length, bn.length)
  return max === 0 ? 0 : 1 - levenshtein(an, bn) / max
}

/**
 * How confusable two descriptions are, 0..1. Blends word overlap (what the tool is about)
 * with trigram overlap (how it's phrased); both matter for whether a model can tell them apart.
 */
export function descriptionSimilarity(a: string, b: string): number {
  if (!a.trim() || !b.trim()) return 0
  const words = jaccard(contentWords(a), contentWords(b))
  const chars = jaccard(trigrams(a), trigrams(b))
  return Number((words * 0.6 + chars * 0.4).toFixed(4))
}
