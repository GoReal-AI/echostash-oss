import { z } from 'zod'

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
  /**
   * Whether (and whom) to trust for the client IP behind a proxy/load balancer. Passed straight
   * to Fastify's `trustProxy`. 'true'/'false' toggle it; anything else is treated as a comma-list
   * of trusted IPs/CIDRs. Leave 'false' unless a known proxy sits in front (else IPs are spoofable).
   */
  TRUST_PROXY: z.string().default('false'),
})

export type Env = z.infer<typeof EnvSchema>

let cached: Env | undefined

export function loadEnv(): Env {
  if (cached) return cached
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
