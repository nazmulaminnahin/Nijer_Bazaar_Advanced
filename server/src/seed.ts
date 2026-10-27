import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { eq } from 'drizzle-orm';
import { closeDb, db, testConnection } from './config/db';
import {
  admins, categories, couriers, productImages, products, settings, shippingZones, staffProfiles,
} from './schemas/index';
import { SETTING_DEFINITIONS } from './config/settings.registry';
import { env } from './config/env';

/**
 * Idempotent seed:
 *  - settings defaults, two shipping zones, courier list
 *  - first super admin (password generated when SEED_ADMIN_PASSWORD is absent)
 *  - a small demo catalogue with locally generated placeholder artwork
 * Customer testimonials are intentionally NOT seeded — reviews must be real.
 */
const uploadRoot = path.isAbsolute(env.UPLOAD_DIR) ? env.UPLOAD_DIR : path.join(process.cwd(), env.UPLOAD_DIR);

async function seed() {
  await testConnection();

  for (const def of SETTING_DEFINITIONS) {
    const existing = await db.select({ id: settings.id }).from(settings).where(eq(settings.key, def.key)).limit(1);
    if (!existing.length) {
      await db.insert(settings).values({ key: def.key, value: def.default, type: def.type, group: def.group });
    }
  }
  console.log(`✅ Settings ready (${SETTING_DEFINITIONS.length} keys)`);

  const email = env.SEED_ADMIN_EMAIL.toLowerCase();
  const [existingAdmin] = await db.select({ id: admins.id }).from(admins).where(eq(admins.email, email)).limit(1);
  if (!existingAdmin) {
    const password = env.SEED_ADMIN_PASSWORD || `NB-${Math.random().toString(36).slice(2, 10)}${Math.floor(Math.random() * 90 + 10)}!`;
    const [admin] = await db
      .insert(admins)
      .values({
        name: 'Nijer Bazaar Admin',
        email,
        phone: env.SEED_ADMIN_PHONE,
        password: await bcrypt.hash(password, 12),
        role: 'super_admin',
        isActive: true,
        permissions: [],
      })
      .returning();
    await db.insert(staffProfiles).values({
      adminId: admin.id, designation: 'Proprietor', department: 'Management',
      monthlySalary: '0', employmentStatus: 'active',
    });
    console.log(`✅ Super admin created: ${email}`);
    if (!env.SEED_ADMIN_PASSWORD) {
      const outFile = path.join(process.cwd(), 'seed-credentials.txt');
      fs.writeFileSync(outFile, [
        'Nijer Bazaar — generated super admin credentials',
        `Email:    ${email}`,
        `Phone:    ${env.SEED_ADMIN_PHONE}`,
        `Password: ${password}`,
        '',
        'Log in, change this password immediately, then delete this file.',
      ].join('\n'));
      console.log(`🔑 Generated password written to ${outFile} (delete after first login)`);
    }
  } else {
    console.log('ℹ️  Super admin already exists — left untouched');
  }

  const zones = [
    { name: 'ঢাকার ভিতরে', code: 'inside_dhaka', districts: ['Dhaka'], charge: '60', freeShippingEligible: true, freeShippingThreshold: '999' },
    { name: 'ঢাকার বাইরে', code: 'outside_dhaka', districts: ['*'], charge: '120', freeShippingEligible: false, freeShippingThreshold: null },
  ];
  for (const zone of zones) {
    const [existing] = await db.select({ id: shippingZones.id }).from(shippingZones).where(eq(shippingZones.code, zone.code)).limit(1);
    if (!existing) await db.insert(shippingZones).values(zone as never);
  }
  console.log('✅ Shipping zones ready');

  for (const courier of [
    { name: 'Pathao', insideDhakaCharge: '70', outsideDhakaCharge: '130', trackingUrl: 'https://pathao.com/tracking' },
    { name: 'Steadfast', insideDhakaCharge: '60', outsideDhakaCharge: '120', trackingUrl: 'https://steadfast.com.bd/tracking' },
    { name: 'RedX', insideDhakaCharge: '65', outsideDhakaCharge: '125', trackingUrl: 'https://redx.com.bd/track' },
  ]) {
    const [existing] = await db.select({ id: couriers.id }).from(couriers).where(eq(couriers.name, courier.name)).limit(1);
    if (!existing) await db.insert(couriers).values(courier as never);
  }
  console.log('✅ Couriers ready');

  const [anyProduct] = await db.select({ id: products.id }).from(products).limit(1);
  if (anyProduct) {
    console.log('ℹ️  Products already exist — catalogue seed skipped');
    await closeDb();
    console.log('🎉 Seed complete');
    return;
  }

  const createdCategories = [];
  for (const cat of [
    { name: 'Electronics', nameBn: 'ইলেকট্রনিক্স', isFeatured: true },
    { name: 'Home & Kitchen', nameBn: 'হোম ও কিচেন', isFeatured: true },
    { name: 'Fashion', nameBn: 'ফ্যাশন', isFeatured: true },
    { name: 'Beauty & Care', nameBn: 'বিউটি ও কেয়ার', isFeatured: true },
    { name: 'Grocery', nameBn: 'মুদি বাজার', isFeatured: false },
  ]) {
    const slug = cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const [row] = await db.insert(categories).values({ ...cat, slug, isActive: true }).returning();
    createdCategories.push(row);
  }

  const productSeed = [
    { name: 'Wireless Earbuds Pro', cat: 0, price: 2450, sale: 1990, stock: 40, featured: true },
    { name: '20000mAh Power Bank', cat: 0, price: 2890, sale: 2450, stock: 30, featured: true },
    { name: 'Non-stick Frying Pan 28cm', cat: 1, price: 1450, sale: 1190, stock: 25, featured: true },
    { name: 'Cotton Panjabi (Premium)', cat: 2, price: 2190, sale: 1790, stock: 18, featured: true },
    { name: 'Herbal Face Wash 150ml', cat: 3, price: 480, sale: 420, stock: 60, featured: false },
    { name: 'Miniket Rice 5kg', cat: 4, price: 620, sale: null, stock: 100, featured: false },
    { name: 'USB-C Fast Charger 33W', cat: 0, price: 990, sale: 850, stock: 55, featured: false },
    { name: 'Stainless Steel Water Bottle 1L', cat: 1, price: 780, sale: 690, stock: 45, featured: false },
  ];

  const imageDir = path.join(uploadRoot, 'products');
  fs.mkdirSync(imageDir, { recursive: true });

  let skuCounter = 1001;
  for (const item of productSeed) {
    const slug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const [row] = await db
      .insert(products)
      .values({
        name: item.name,
        slug,
        sku: `NB-${skuCounter++}`,
        description: `${item.name} — নিজের বাজারের যাচাইকৃত পণ্য।`,
        shortDescription: `${item.name} · দ্রুত ডেলিভারি`,
        categoryId: createdCategories[item.cat].id,
        price: String(item.price),
        salePrice: item.sale ? String(item.sale) : null,
        costPrice: String(Math.round(item.price * 0.7)),
        stock: item.stock,
        isFeatured: item.featured,
        isNewArrival: true,
        isActive: true,
        rating: '4.50',
        tags: ['demo'],
      })
      .returning();

    // Locally generated placeholder artwork (no external image hosts).
    const fileName = `seed-${row.id}.png`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="700">
      <rect width="700" height="700" fill="#fff7ed"/>
      <circle cx="560" cy="140" r="120" fill="#fed7aa"/>
      <text x="60" y="330" font-family="sans-serif" font-size="34" font-weight="700" fill="#9a3412">${row.name.replace(/[<&>]/g, '').slice(0, 24)}</text>
      <text x="60" y="385" font-family="sans-serif" font-size="22" fill="#c2410c">Nijer Bazaar</text>
      <rect x="60" y="430" width="150" height="6" fill="#f97316"/>
    </svg>`;
    await sharp(Buffer.from(svg)).png().toFile(path.join(imageDir, fileName));

    await db.insert(productImages).values({
      productId: row.id,
      imageUrl: `${env.UPLOAD_PUBLIC_PREFIX}/products/${fileName}`,
      isMain: true,
      sortOrder: 0,
    });
  }
  console.log(`✅ Demo catalogue: ${createdCategories.length} categories, ${productSeed.length} products`);

  await closeDb();
  console.log('🎉 Seed complete');
}

seed().catch(async (err) => {
  console.error('❌ Seed failed:', err);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
