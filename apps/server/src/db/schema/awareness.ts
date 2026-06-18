import type {
  ContentBlock,
  Message,
  ModelParams,
  Provider,
  Resolution,
  SourceKind,
} from '@echostash/shared'
import { createId } from '@paralleldrive/cuid2'
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => createId())

export const projects = pgTable('projects', {
  id: id(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const sources = pgTable('sources', {
  id: id(),
  kind: text('kind').$type<SourceKind>().notNull(),
  name: text('name').notNull(),
  config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** A prompt identity — stable across content edits via its call-site fingerprint. */
export const prompts = pgTable(
  'prompts',
  {
    id: id(),
    fingerprint: text('fingerprint').notNull().unique(),
    name: text('name').notNull(),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
    type: text('type').$type<'prompt' | 'skill'>().notNull().default('prompt'),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('prompts_project_idx').on(t.projectId)],
)

/** Append-only observed versions. contentHash = the prompt; configHash = model+params. */
export const promptSnapshots = pgTable(
  'prompt_snapshots',
  {
    id: id(),
    promptId: text('prompt_id')
      .notNull()
      .references(() => prompts.id, { onDelete: 'cascade' }),
    contentHash: text('content_hash').notNull(),
    configHash: text('config_hash').notNull(),
    content: jsonb('content').$type<ContentBlock[]>().notNull().default([]),
    messages: jsonb('messages').$type<Message[]>().notNull().default([]),
    provider: text('provider').$type<Provider>(),
    model: text('model'),
    params: jsonb('params').$type<ModelParams>().notNull().default({}),
    resolution: text('resolution').$type<Resolution>().notNull(),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    gitSha: text('git_sha'),
    gitRef: text('git_ref'),
    filePath: text('file_path'),
    symbol: text('symbol'),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    seenCount: integer('seen_count').notNull().default(1),
  },
  (t) => [
    uniqueIndex('snapshots_prompt_content_idx').on(t.promptId, t.contentHash, t.configHash),
    index('snapshots_prompt_idx').on(t.promptId),
  ],
)

/** One row per scan; drives the change feed. */
export const scanRuns = pgTable(
  'scan_runs',
  {
    id: id(),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    gitSha: text('git_sha'),
    gitRef: text('git_ref'),
    status: text('status').$type<'running' | 'done' | 'error'>().notNull().default('done'),
    promptsFound: integer('prompts_found').notNull().default(0),
    changesDetected: integer('changes_detected').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [index('scan_runs_source_idx').on(t.sourceId)],
)

export const tags = pgTable('tags', {
  id: id(),
  name: text('name').notNull().unique(),
  color: text('color'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const promptTags = pgTable(
  'prompt_tags',
  {
    promptId: text('prompt_id')
      .notNull()
      .references(() => prompts.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [uniqueIndex('prompt_tags_pk').on(t.promptId, t.tagId)],
)
