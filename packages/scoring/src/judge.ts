import type { EvalContext, JudgeFn, ScoreOutcome } from './types'

export type JudgeScale = 'binary' | 'unit' | 'likert'

export function buildJudgePrompt(
  rubric: string,
  output: string,
  expected?: unknown,
  scale: JudgeScale = 'unit',
): string {
  const scaleInstruction =
    scale === 'binary'
      ? 'Set "score" to 1 if it passes, 0 if it fails.'
      : scale === 'likert'
        ? 'Set "score" to an integer from 1 (worst) to 5 (best).'
        : 'Set "score" to a number from 0.0 (worst) to 1.0 (best).'

  const ref =
    expected != null
      ? `\nREFERENCE / EXPECTED:\n${typeof expected === 'string' ? expected : JSON.stringify(expected)}\n`
      : ''

  return `You are a strict evaluation judge. Judge the OUTPUT against the CRITERIA.

CRITERIA:
${rubric}
${ref}
OUTPUT:
${output}

Respond with ONLY a JSON object: {"score": <number>, "reason": "<one sentence>"}. ${scaleInstruction}`
}

/** Parse a judge model's reply into a 0..1 score. Lenient: strips fences, finds the JSON. */
export function parseJudgeVerdict(text: string, scale: JudgeScale = 'unit'): ScoreOutcome {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    return { score: 0, reason: `could not parse judge reply: ${text.slice(0, 120)}` }
  }
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return { score: 0, reason: `invalid judge JSON: ${text.slice(0, 120)}` }
  }

  const reason = typeof parsed.reason === 'string' ? parsed.reason : undefined
  let score: number
  if (typeof parsed.score === 'number') {
    score = scale === 'likert' ? (parsed.score - 1) / 4 : parsed.score
  } else if (typeof parsed.pass === 'boolean') {
    score = parsed.pass ? 1 : 0
  } else {
    return { score: 0, reason: reason ?? 'judge reply had no score/pass' }
  }
  return { score: Math.max(0, Math.min(1, score)), reason }
}

export async function evaluateJudge(
  config: Record<string, unknown>,
  ctx: EvalContext,
  judge: JudgeFn,
): Promise<ScoreOutcome> {
  const rubric = String(config.rubric ?? config.value ?? '')
  if (!rubric) return { score: 0, reason: 'judge scorer is missing a `rubric`' }
  const scale: JudgeScale =
    config.scale === 'binary' || config.scale === 'likert' ? config.scale : 'unit'
  const expected = config.useExpected === false ? undefined : ctx.expected
  const prompt = buildJudgePrompt(rubric, ctx.output, expected, scale)
  const reply = await judge(prompt)
  return parseJudgeVerdict(reply, scale)
}
