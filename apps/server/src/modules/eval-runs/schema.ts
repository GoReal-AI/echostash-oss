import { EvalResult, EvalStatus, EvalTrigger } from '@echostash/shared'
import { z } from 'zod'

export const CreateEvalRun = z.object({
  promptId: z.string().min(1, 'promptId is required'),
  datasetId: z.string().min(1, 'datasetId is required'),
  variantIds: z.array(z.string().min(1)).min(1, 'select at least one variant'),
  scorerIds: z.array(z.string().min(1)).min(1, 'select at least one scorer'),
  sampleCount: z.number().int().min(1).max(20).default(1),
  trigger: EvalTrigger.default('manual'),
})
export type CreateEvalRun = z.infer<typeof CreateEvalRun>

/** Runner heartbeat — running while it works, error if it gave up. */
export const UpdateStatus = z.object({
  status: EvalStatus,
  error: z.string().nullish(),
})

export { EvalResult }
