import { SCORER_CATALOG } from '@echostash/scoring'
import { AssertionOp, ScorerFamily } from '@echostash/shared'
import { z } from 'zod'

/** family → set of valid ops, from the shared scorer catalog (single source of truth). */
const OPS_BY_FAMILY = new Map(
  SCORER_CATALOG.map((f) => [f.family, new Set(f.ops.map((o) => o.op))]),
)

/** Is this (family, op) pair a real scorer the runner can execute? */
export function isValidScorer(family: string, op: string): boolean {
  return OPS_BY_FAMILY.get(family as never)?.has(op as never) ?? false
}

const base = {
  name: z.string().min(1, 'name is required'),
  family: ScorerFamily,
  op: AssertionOp,
  config: z.record(z.unknown()).default({}),
  weight: z.number().positive().default(1),
  threshold: z.number().min(0).max(1).nullish(),
  negate: z.boolean().default(false),
}

export const CreateScorer = z.object(base).refine((s) => isValidScorer(s.family, s.op), {
  message: 'op is not valid for this family — see the scorer catalog',
  path: ['op'],
})
export type CreateScorer = z.infer<typeof CreateScorer>

export const UpdateScorer = z
  .object({
    name: z.string().min(1),
    config: z.record(z.unknown()),
    weight: z.number().positive(),
    threshold: z.number().min(0).max(1).nullable(),
    negate: z.boolean(),
  })
  .partial()
export type UpdateScorer = z.infer<typeof UpdateScorer>
