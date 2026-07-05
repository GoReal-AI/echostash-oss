import { Message } from '@echostash/shared'
import { z } from 'zod'

/** Turn a display name into a url-safe slug. */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'dataset'
  )
}

export const CreateDataset = z.object({
  name: z.string().min(1, 'name is required'),
  slug: z.string().min(1).optional(),
  description: z.string().nullish(),
  promptId: z.string().nullish(),
})
export type CreateDataset = z.infer<typeof CreateDataset>

export const UpdateDataset = z
  .object({
    name: z.string().min(1),
    description: z.string().nullable(),
    promptId: z.string().nullable(),
  })
  .partial()
export type UpdateDataset = z.infer<typeof UpdateDataset>

export const CreateCase = z.object({
  name: z.string().min(1, 'name is required'),
  input: z.record(z.unknown()).default({}),
  messages: z.array(Message).optional(),
  expected: z.unknown().nullish(),
  source: z.enum(['manual', 'import']).default('manual'),
  position: z.number().int().optional(),
})
export type CreateCase = z.infer<typeof CreateCase>

export const UpdateCase = z
  .object({
    name: z.string().min(1),
    input: z.record(z.unknown()),
    messages: z.array(Message).nullable(),
    expected: z.unknown(),
    position: z.number().int(),
  })
  .partial()
export type UpdateCase = z.infer<typeof UpdateCase>
