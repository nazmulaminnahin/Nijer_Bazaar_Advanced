import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Boots an isolated embedded Postgres for a test file and returns an Express app
 * with all routes mounted. Migrations are applied from ./drizzle.
 */
export async function createTestApp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nb-test-'));
  process.env.DB_DRIVER = 'pglite';
  process.env.PGLITE_DIR = dir;
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-customer-secret-0123456789';
  process.env.JWT_ADMIN_SECRET = 'test-admin-secret-0123456789';
  process.env.UPLOAD_DIR = path.join(dir, 'uploads');

  // The app's db module reads env at import time, so it must be imported after
  // the environment above is set. Migrations run through the same connection.
  const { db, closeDb } = await import('../src/config/db');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  await migrate(db as never, { migrationsFolder: path.resolve(__dirname, '../drizzle') });

  const { createApp } = await import('../src/index');
  const app = createApp();

  return {
    app,
    dir,
    async close() {
      await closeDb();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

export const ADMIN_EMAIL = 'admin@test.com';
export const ADMIN_PASSWORD = 'AdminPass123!';
export const CUSTOMER_PHONE = '01712345678';
export const CUSTOMER_PASSWORD = 'Customer123!';

export async function seedBasics() {
  const bcrypt = (await import('bcryptjs')).default;
  const { db } = await import('../src/config/db');
  const { admins, categories, shippingZones, products, productImages, settings } = await import('../src/schemas/index');
  const { SETTING_DEFINITIONS } = await import('../src/config/settings.registry');

  for (const def of SETTING_DEFINITIONS) {
    await db.insert(settings).values({ key: def.key, value: def.default, type: def.type, group: def.group });
  }

  await db.insert(admins).values({
    name: 'Test Admin', email: ADMIN_EMAIL, phone: '01700000000',
    password: await bcrypt.hash(ADMIN_PASSWORD, 4), role: 'super_admin',
  });

  await db.insert(shippingZones).values([
    { name: 'ঢাকার ভিতরে', code: 'inside_dhaka', districts: ['Dhaka'], charge: '60', freeShippingEligible: true, freeShippingThreshold: '999' },
    { name: 'ঢাকার বাইরে', code: 'outside_dhaka', districts: ['*'], charge: '120', freeShippingEligible: false, freeShippingThreshold: null },
  ]);

  const [cat] = await db.insert(categories).values({ name: 'Test Category', slug: 'test-category' }).returning();
  const [cheap] = await db
    .insert(products)
    .values({ name: 'Cheap Item', slug: 'cheap-item', sku: 'SKU-1', price: '500', stock: 20, categoryId: cat.id })
    .returning();
  const [pricey] = await db
    .insert(products)
    .values({ name: 'Pricey Item', slug: 'pricey-item', sku: 'SKU-2', price: '2500', stock: 10, categoryId: cat.id })
    .returning();
  await db.insert(productImages).values([
    { productId: cheap.id, imageUrl: '/uploads/products/cheap.png', isMain: true },
    { productId: pricey.id, imageUrl: '/uploads/products/pricey.png', isMain: true },
  ]);

  return { categoryId: cat.id, cheapId: cheap.id, priceyId: pricey.id };
}

export async function loginAdmin(app: any) {
  const request = (await import('supertest')).default;
  const res = await request(app).post('/api/auth/admin/login').send({ identifier: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (!res.body.token) throw new Error(`admin login failed: ${JSON.stringify(res.body)}`);
  return res.body.token as string;
}

export async function loginCustomer(app: any) {
  const request = (await import('supertest')).default;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Test Customer', email: 'customer@test.com', phone: CUSTOMER_PHONE, password: CUSTOMER_PASSWORD });
  if (res.body.token) return res.body.token as string;
  const login = await request(app).post('/api/auth/login').send({ identifier: CUSTOMER_PHONE, password: CUSTOMER_PASSWORD });
  return login.body.token as string;
}

export const DHAKA_ADDRESS = {
  name: 'Test Customer', phone: CUSTOMER_PHONE, address: 'House 1, Road 2, Mirpur',
  division: 'Dhaka', district: 'Dhaka', thana: 'Mirpur', postalCode: '1216',
};
export const CTG_ADDRESS = { ...DHAKA_ADDRESS, district: 'Chattogram', division: 'Chattogram', thana: 'Kotwali' };
