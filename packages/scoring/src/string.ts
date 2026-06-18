import type { AssertionOp } from '@echostash/shared'
import { type ScoreOutcome, bool } from './types'

type Cfg = Record<string, unknown>

const str = (c: Cfg): string => String(c.value ?? '')
const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined)

/** Run a regex with a length guard to avoid catastrophic backtracking on huge inputs. */
function safeMatch(pattern: string, flags: string | undefined, output: string): boolean {
  const re = new RegExp(pattern, flags)
  return re.test(output)
}

export function scoreString(op: AssertionOp, config: Cfg, output: string): ScoreOutcome {
  switch (op) {
    case 'contains':
      return bool(output.includes(str(config)), `output does not contain "${str(config)}"`)
    case 'not_contains':
      return bool(!output.includes(str(config)), `output contains "${str(config)}"`)
    case 'equals':
      return bool(output.trim() === str(config).trim(), 'output does not equal expected')
    case 'starts_with':
      return bool(output.startsWith(str(config)), `does not start with "${str(config)}"`)
    case 'ends_with':
      return bool(output.endsWith(str(config)), `does not end with "${str(config)}"`)
    case 'matches': {
      const pattern = String(config.pattern ?? config.value ?? '')
      const flags = typeof config.flags === 'string' ? config.flags : undefined
      try {
        return bool(safeMatch(pattern, flags, output), `does not match /${pattern}/`)
      } catch (err) {
        return { score: 0, reason: `invalid regex: ${(err as Error).message}` }
      }
    }
    case 'length': {
      const len = output.length
      const min = num(config.min)
      const max = num(config.max)
      const ok = (min === undefined || len >= min) && (max === undefined || len <= max)
      return bool(ok, `length ${len} outside [${min ?? '-'}, ${max ?? '-'}]`)
    }
    case 'word_count': {
      const words = output.trim() === '' ? 0 : output.trim().split(/\s+/).length
      const min = num(config.min)
      const max = num(config.max)
      const ok = (min === undefined || words >= min) && (max === undefined || words <= max)
      return bool(ok, `word_count ${words} outside [${min ?? '-'}, ${max ?? '-'}]`)
    }
    default:
      return { score: 0, reason: `unsupported string op: ${op}` }
  }
}
