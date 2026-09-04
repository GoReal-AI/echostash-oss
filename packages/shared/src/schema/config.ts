import { z } from 'zod'

export const EchostashConfig = z.object({
  url: z.string().url().default('http://localhost:8080'),
  apiKey: z.string().optional(),
  project: z.string().optional(),
  source: z.string().optional(),
})
export type EchostashConfig = z.infer<typeof EchostashConfig>
