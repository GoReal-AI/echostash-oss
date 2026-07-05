import { Message, ModelParams, Provider } from '@echostash/shared'
import { z } from 'zod'

export const CreateVariant = z.object({
  promptId: z.string().min(1, 'promptId is required'),
  name: z.string().min(1, 'name is required'),
  messages: z.array(Message).default([]),
  provider: Provider,
  model: z.string().min(1, 'model is required'),
  params: ModelParams.default({}),
  source: z.enum(['snapshot', 'sandbox']).default('sandbox'),
  baseSnapshotId: z.string().nullish(),
})
export type CreateVariant = z.infer<typeof CreateVariant>
