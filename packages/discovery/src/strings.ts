/** String-literal extraction shared by the call-site resolver and the content-signal fallback. */

/** Derive a stable name from a definition/assignment line (`const FOO = \`…\`` → `FOO`). */
const nameOf = (line: string): string | undefined =>
  line.match(/(\w[\w$.-]*)\s*[:=]\s*[`"']/)?.[1] ??
  line.match(/(?:const|let|var|val|String|final)\s+(\w[\w$]*)/)?.[1]

/** Collect a string body from an opener delimiter at (openLine, startCol) to its closing delimiter. */
function collect(lines: string[], openLine: number, startCol: number, delim: string): string {
  let text = ''
  for (let i = openLine; i < lines.length && i < openLine + 400; i++) {
    const seg = i === openLine ? (lines[i] ?? '').slice(startCol) : (lines[i] ?? '')
    const close = seg.indexOf(delim)
    if (close !== -1) return text + (i === openLine ? '' : '\n') + seg.slice(0, close)
    text += (i === openLine ? '' : '\n') + seg
  }
  return text
}

/** A multi-line string literal opening on `lines[lineIdx]` — backtick or triple-quote (Java text-block). */
function multilineOpener(
  lines: string[],
  lineIdx: number,
): { text: string; fromLine: number } | null {
  const line = lines[lineIdx] ?? ''
  for (const delim of ['"""', "'''"]) {
    const c = line.indexOf(delim)
    if (c !== -1) {
      const text = collect(lines, lineIdx, c + delim.length, delim)
      if (text.trim()) return { text, fromLine: lineIdx + 1 }
    }
  }
  const bt = line.indexOf('`')
  if (bt !== -1) {
    const text = collect(lines, lineIdx, bt + 1, '`')
    if (text.trim()) return { text, fromLine: lineIdx + 1 }
  }
  return null
}

/** A string literal opening on `lines[lineIdx]` — multi-line, or a single-line `key = "…"` value. */
export function extractStringAt(
  lines: string[],
  line: string,
  lineIdx: number,
): { text: string; fromLine: number } | null {
  const multi = multilineOpener(lines, lineIdx)
  if (multi) return multi
  const single = line.match(/[:=]\s*(["'])((?:\\.|(?!\1).)*)\1/)
  return single?.[2] ? { text: single[2], fromLine: lineIdx + 1 } : null
}

/** Extract the string literal that contains `matchLine` (walks back up to 12 lines to find the opener). */
export function extractEnclosingString(
  content: string,
  matchLine: number,
): { name?: string; text: string; fromLine: number } | null {
  const lines = content.split('\n')
  const idx = matchLine - 1
  if (idx < 0 || idx >= lines.length) return null

  for (let i = idx; i >= Math.max(0, idx - 12); i--) {
    const opener = multilineOpener(lines, i)
    if (opener) return { name: nameOf(lines[i] ?? ''), ...opener }
  }
  const single = (lines[idx] ?? '').match(/["']([^"']{20,})["']/)
  if (single?.[1]) return { name: nameOf(lines[idx] ?? ''), text: single[1], fromLine: matchLine }
  return null
}
