import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { env } from '../config/env';
import { closeDb, db } from '../config/db';
import { admins } from '../schemas/index';

/**
 * Explicit, non-destructive recovery for the configured super-admin account.
 * Requires RESET_ADMIN_PASSWORD=true and a non-empty SEED_ADMIN_PASSWORD.
 * Does not create/reactivate accounts or alter any other database data.
 */
async function main() {
  if (process.env.RESET_ADMIN_PASSWORD !== 'true') {
    throw new Error('Set RESET_ADMIN_PASSWORD=true to confirm this password reset.');
  }
  if (!env.SEED_ADMIN_PASSWORD || env.SEED_ADMIN_PASSWORD.length < 8) {
    throw new Error('Set SEED_ADMIN_PASSWORD in server/.env (at least 8 characters).');
  }

  const email = env.SEED_ADMIN_EMAIL.toLowerCase();
  const [admin] = await db.select({ id: admins.id }).from(admins).where(eq(admins.email, email)).limit(1);
  if (!admin) {
    throw new Error(`No admin account found for ${email}. Run npm run db:seed first on a new setup.`);
  }

  await db.update(admins)
    .set({ password: await bcrypt.hash(env.SEED_ADMIN_PASSWORD, 12), updatedAt: new Date() })
    .where(eq(admins.id, admin.id));
  console.log(`✅ Password updated for ${email}. Existing database data was not changed.`);
}

main()
  .catch((error) => {
    console.error('❌ Admin password reset failed:', (error as Error).message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb().catch(() => undefined);
  });
