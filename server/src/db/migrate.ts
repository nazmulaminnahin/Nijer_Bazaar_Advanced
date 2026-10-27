import path from 'path';
import { env } from '../config/env';
import { ensurePgliteDirs } from './pgliteDirs';

/**
 * Applies the generated SQL migrations to whichever driver is configured.
 * Usage: npm run db:migrate
 */
async function main() {
  const migrationsFolder = path.join(__dirname, '../../drizzle');

  if (env.DB_DRIVER === 'pglite') {
    const { PGlite } = await import('@electric-sql/pglite');
    const { drizzle } = await import('drizzle-orm/pglite');
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    ensurePgliteDirs(env.PGLITE_DIR);
    const client = new PGlite(env.PGLITE_DIR);
    const db = drizzle(client);
    await migrate(db, { migrationsFolder });
    await client.close();
  } else {
    const { Pool } = await import('pg');
    const { drizzle } = await import('drizzle-orm/node-postgres');
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    const pool = new Pool({
      ...(env.DATABASE_URL
        ? { connectionString: env.DATABASE_URL }
        : { host: env.DB_HOST, port: env.DB_PORT, database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD }),
      ssl: env.DB_SSL ? { rejectUnauthorized: false } : undefined,
    });
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder });
    await pool.end();
  }
  console.log('✅ Migrations applied');
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
