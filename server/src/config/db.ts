import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../schemas/index';
import { env } from './env';
import { ensurePgliteDirs } from '../db/pgliteDirs';

export type Schema = typeof schema;
export type Database = NodePgDatabase<Schema>;

let _db: any;
let _close: () => Promise<void> = async () => {};

/**
 * DB_DRIVER=postgres  -> node-postgres pool (production)
 * DB_DRIVER=pglite    -> embedded Postgres-in-WASM (local dev + test runs)
 */
if (env.DB_DRIVER === 'pglite') {
  // Lazily required so production bundles never load the embedded engine.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PGlite } = require('@electric-sql/pglite');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { drizzle: drizzlePglite } = require('drizzle-orm/pglite');
  ensurePgliteDirs(env.PGLITE_DIR);
  const client = new PGlite(env.PGLITE_DIR);
  _db = drizzlePglite(client, { schema });
  _close = async () => {
    await client.close();
  };
} else {
  const pool = new Pool({
    ...(env.DATABASE_URL
      ? { connectionString: env.DATABASE_URL }
      : {
          host: env.DB_HOST,
          port: env.DB_PORT,
          database: env.DB_NAME,
          user: env.DB_USER,
          password: env.DB_PASSWORD,
        }),
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: env.DB_SSL ? { rejectUnauthorized: false } : undefined,
  });
  pool.on('error', (err) => console.error('❌ PostgreSQL pool error:', err.message));
  _db = drizzlePg(pool, { schema });
  _close = async () => {
    await pool.end();
  };
}

export const db: Database = _db;
export type DbClient = Database;

export async function testConnection(): Promise<void> {
  try {
    if (env.DB_DRIVER === 'pglite') {
      await _db.execute('select 1');
      console.log(`✅ Embedded Postgres (PGlite) ready → ${env.PGLITE_DIR}`);
      return;
    }
    const result = await (_db as any).execute('select current_database() as db');
    const name = result?.rows?.[0]?.db;
    console.log(`✅ PostgreSQL connected → database: ${name}`);
  } catch (error) {
    console.error('❌ Database connection failed:', (error as Error).message);
    throw error;
  }
}

export async function closeDb(): Promise<void> {
  await _close();
}
