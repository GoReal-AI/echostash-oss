import { createHash, randomBytes } from 'node:crypto'
import { eq, isNull } from 'drizzle-orm'
import type { Database } from '../../db/client'
import { apiKeys } from '../../db/schema'
import { API_KEY_PREFIX, apiKeyPrefix } from '../../plugins/auth'

export interface ApiKeyCreated {
  id: string
  name: string
  prefix: string
  key: string // shown only once on creation
}

/** Postgres unique-violation SQLSTATE — the prefix column is unique. */
const PG_UNIQUE_VIOLATION = '23505'
/** How many times to regenerate a key if its prefix happens to collide. */
const MAX_PREFIX_ATTEMPTS = 5

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: string }).code === PG_UNIQUE_VIOLATION
  )
}

/**
 * Create a new API key. Returns the id, name, prefix, and the full key (shown ONCE).
 *
 * The prefix is the indexed, unique lookup column. With 8 random hex chars a collision is
 * astronomically unlikely, but if one ever occurs the unique constraint rejects the insert —
 * so we regenerate a fresh key and retry, keeping creation reliable regardless of key count.
 */
export async function createApiKey(db: Database, name: string): Promise<ApiKeyCreated> {
  for (let attempt = 1; attempt <= MAX_PREFIX_ATTEMPTS; attempt++) {
    // Random 24-byte key (48 hex chars) with the "ek_" prefix.
    const randomPart = randomBytes(24).toString('hex')
    const fullKey = `${API_KEY_PREFIX}${randomPart}`
    const prefix = apiKeyPrefix(fullKey) // derived the same way verifyApiKey does it
    const hash = createHash('sha256').update(fullKey).digest('hex')

    try {
      const inserted = await db.insert(apiKeys).values({ name, hash, prefix }).returning({
        id: apiKeys.id,
      })
      const id = inserted[0]?.id
      if (!id) throw new Error('Failed to create API key')
      return { id, name, prefix, key: fullKey }
    } catch (err) {
      // Only retry on a prefix collision; rethrow anything else immediately.
      if (isUniqueViolation(err) && attempt < MAX_PREFIX_ATTEMPTS) continue
      throw err
    }
  }
  // Unreachable: the loop either returns or throws, but satisfies the type checker.
  throw new Error('Failed to create API key after multiple attempts')
}

export interface ApiKeyListed {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

/**
 * List API keys. Filtering happens in SQL (not in memory): by default only non-revoked keys
 * are returned, so the query stays selective as the table grows.
 */
export async function listApiKeys(db: Database, includeRevoked = false): Promise<ApiKeyListed[]> {
  // `undefined` means "no filter"; otherwise restrict to rows where revokedAt IS NULL.
  const where = includeRevoked ? undefined : isNull(apiKeys.revokedAt)
  const rows = await db.select().from(apiKeys).where(where).orderBy(apiKeys.createdAt)
  return rows.map((k) => ({
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    createdAt: k.createdAt.toISOString(),
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    revokedAt: k.revokedAt?.toISOString() ?? null,
  }))
}

/**
 * Revoke an API key (soft delete: set revokedAt).
 */
export async function revokeApiKey(db: Database, keyId: string): Promise<boolean> {
  const updated = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(eq(apiKeys.id, keyId))
    .returning({ id: apiKeys.id })

  return updated.length > 0
}
