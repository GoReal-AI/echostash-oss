import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

/**
 * Repo-root .env, resolved from this source file (not the cwd) so it's found no matter where
 * the process is launched from. In production we inject real env vars and ship no .env file,
 * so the existsSync guard below makes this a no-op there.
 */
const envPath = join(dirname(fileURLToPath(import.meta.url)), '../../../.env')

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().default(8080),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  MIGRATE_ON_START: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  ADMIN_PASSWORD: z.string().default('changeme'),
  SESSION_SECRET: z.string().default('please-change-me-to-a-long-random-string'),
})

export type Env = z.infer<typeof EnvSchema>

let cached: Env | undefined

export function loadEnv(): Env {
  if (cached) return cached
  // Populate process.env from the repo-root .env in local dev (skipped in prod, where there's none).
  if (existsSync(envPath)) process.loadEnvFile(envPath)
  const parsed = EnvSchema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid environment configuration:\n${issues}`)
  }
  cached = parsed.data
  return cached
}
