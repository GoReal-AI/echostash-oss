import { buildApp } from './app'
import { createDb } from './db/client'
import { runMigrations } from './db/migrate'
import { loadEnv } from './env'

async function main(): Promise<void> {
  const env = loadEnv()

  if (env.MIGRATE_ON_START) {
    console.log('Running migrations…')
    await runMigrations(env.DATABASE_URL)
  }

  const { db, client } = createDb(env.DATABASE_URL)
  const app = await buildApp({ db, sql: client })

  const close = async () => {
    await app.close()
    await client.end({ timeout: 5 })
    process.exit(0)
  }
  process.on('SIGTERM', close)
  process.on('SIGINT', close)

  await app.listen({ host: env.HOST, port: env.PORT })
}

main().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
