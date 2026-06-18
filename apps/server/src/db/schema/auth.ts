import { createId } from '@paralleldrive/cuid2'
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => createId())

export const apiKeys = pgTable('api_keys', {
  id: id(),
  name: text('name').notNull(),
  /** sha-256 of the full key; the plaintext is shown once on creation */
  hash: text('hash').notNull(),
  /** indexed lookup prefix (e.g. "pf_ab12") */
  prefix: text('prefix').notNull().unique(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Optional per-instance settings (encrypted provider keys, LiteLLM baseURL, ...). */
export const workspaceSettings = pgTable('workspace_settings', {
  id: id(),
  key: text('key').notNull().unique(),
  valueEncrypted: text('value_encrypted').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
