import { z } from 'zod'

export const ProviderConfig = z.object({
  provider: z.string(),
  name: z.string(),
  configured: z.boolean(),
  keyMasked: z.string().nullable(),
  updatedAt: z.string().optional(),
})
export type ProviderConfig = z.infer<typeof ProviderConfig>

export const SetProviderKeyRequest = z.object({
  apiKey: z.string().min(1),
})
export type SetProviderKeyRequest = z.infer<typeof SetProviderKeyRequest>
