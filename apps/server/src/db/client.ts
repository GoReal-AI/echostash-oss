import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema/index'

export type Database = ReturnType<typeof createDb>['db']
export type PgClient = ReturnType<typeof createDb>['client']

export function createDb(databaseUrl: string) {
  const client = postgres(databaseUrl, { max: 10 })
  const db = drizzle(client, { schema })
  return { db, client }
}
