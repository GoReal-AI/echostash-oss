import { realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { loadEnv } from '../env'
import { createDb } from './client'

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), 'migrations')

function isRunDirectly(): boolean {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href
  } catch {
    return false
  }
}

export async function runMigrations(databaseUrl: string): Promise<void> {
  const { db, client } = createDb(databaseUrl)
  try {
    await migrate(db, { migrationsFolder })
  } finally {
    await client.end({ timeout: 5 })
  }
}

// Allow running directly: `tsx src/db/migrate.ts`
if (isRunDirectly()) {
  const env = loadEnv()
  runMigrations(env.DATABASE_URL)
    .then(() => {
      console.log('Migrations applied.')
      process.exit(0)
    })
    .catch((err) => {
      console.error('Migration failed:', err)
      process.exit(1)
    })
}
