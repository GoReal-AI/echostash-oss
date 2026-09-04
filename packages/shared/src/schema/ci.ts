import { z } from 'zod'

export const CiCheckRequest = z.object({
  gitSha: z.string().optional(),
  gitRef: z.string().optional(),
  changedFingerprints: z.array(z.string()),
  threshold: z.number().default(0),
})
export type CiCheckRequest = z.infer<typeof CiCheckRequest>

export const CiCheckPromptResult = z.object({
  fingerprint: z.string(),
  score: z.number(),
  baseline: z.number().nullable(),
  delta: z.number().nullable(),
  regressed: z.boolean(),
})
export type CiCheckPromptResult = z.infer<typeof CiCheckPromptResult>

export const CiCheckResponse = z.object({
  pass: z.boolean(),
  threshold: z.number(),
  results: z.array(CiCheckPromptResult),
})
export type CiCheckResponse = z.infer<typeof CiCheckResponse>
