import type { Classifier, ClassifyItem } from '@echostash/analyzer'
import { generateStructured } from '@echostash/llm'
import { z } from 'zod'

const CLASSIFY_SYSTEM =
  'You are a precise code auditor. You decide whether each candidate string from a codebase is an ' +
  'LLM prompt — text written to instruct or converse with a language model (system prompts, ' +
  'instructions, rubrics, message/agent templates) — versus ordinary content (SQL, logs, UI copy, ' +
  'errors, docs). Be conservative: when unsure, answer false.'

const VerdictSchema = z.object({
  results: z.array(z.object({ id: z.string(), isPrompt: z.boolean() })),
})

/**
 * The default scan classifier: backed by the configured scan model (`@echostash/llm`),
 * batches candidates, and sends previews only (never the full string). `spec` overrides
 * the env-configured `scan` role.
 */
export function makeClassifier(spec?: string): Classifier {
  return async (items: ClassifyItem[]) => {
    const out: { id: string; isPrompt: boolean }[] = []
    const BATCH = 40
    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH)
      const lines = batch
        .map(
          (it) =>
            `#${it.id} name=${it.name ?? '(none)'} loc=${it.filePath}:${it.line} len=${it.length}\n"""${it.preview}"""`,
        )
        .join('\n\n')
      const { results } = await generateStructured({
        spec,
        role: 'scan',
        system: CLASSIFY_SYSTEM,
        prompt: `Classify each candidate. Return a verdict for every id.\n\n${lines}`,
        schema: VerdictSchema,
      })
      out.push(...results)
    }
    return out
  }
}
