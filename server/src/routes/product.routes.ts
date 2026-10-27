import { Router } from 'express';
import { and, count, desc, eq, ilike, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../config/db';
import { categories, inventory, inventoryLog, productImages, products } from '../schemas/index';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticateAdmin, requirePermission } from '../middleware/adminAuth';
import { validateBody } from '../middleware/validate';
import { getProductDetail, listProducts, nextProductSku, replaceProductImages } from '../services/product.service';
import { logStaffAction } from '../services/audit.service';
import { paginate, parseBool, slugify } from '../utils/helpers';

const router = Router();

const productSchema = z.object({
  name: z.string().trim().min(2, 'পণ্যের নাম দিন।').max(500),
  slug: z.string().trim().optional(),
  description: z.string().optional().nullable(),
  shortDescription: z.string().max(500).optional().nullable(),
  categoryId: z.coerce.number().int().positive().optional().nullable(),
  price: z.coerce.number().positive('দাম ০ এর বেশি হতে হবে।'),
  salePrice: z.coerce.number().positive().optional().nullable(),
  costPrice: z.coerce.number().min(0).optional().nullable(),
  sku: z.string().trim().optional(),
  stock: z.coerce.number().int().min(0).default(0),
  lowStockThreshold: z.coerce.number().int().min(0).default(10),
  images: z.array(z.string().trim()).optional(),
  imageUrl: z.string().trim().optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isNewArrival: z.boolean().optional(),
});

function normalizeProductPayload(input: z.infer<typeof productSchema>) {
  if (input.salePrice != null && input.salePrice >= input.price) {
    throw new AppError('সেল প্রাইস রেগুলার প্রাইসের চেয়ে কম হতে হবে।', 422);
  }
  return {
    name: input.name,
    description: input.description ?? null,
    shortDescription: input.shortDescription ?? null,
    categoryId: input.categoryId ?? null,
    price: String(input.price),
    salePrice: input.salePrice == null ? null : String(input.salePrice),
    costPrice: input.costPrice == null ? null : String(input.costPrice),
    stock: input.stock,
    lowStockThreshold: input.lowStockThreshold,
    isActive: input.isActive ?? true,
    isFeatured: input.isFeatured ?? false,
    isNewArrival: input.isNewArrival ?? true,
    updatedAt: new Date(),
  };
}

function imageList(input: z.infer<typeof productSchema>): string[] {
  const list = [...(input.images ?? [])];
  if (input.imageUrl) list.unshift(input.imageUrl);
  return list.filter(Boolean);
}

// ── Public listing ──────────────────────────────────────────────────────────
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit } = paginate(req.query as Record<string, unknown>, 12);
    const result = await listProducts({
      search: (req.query.search as string) || undefined,
      categoryId: req.query.categoryId ? Number(req.query.categoryId) : undefined,
      categorySlug: (req.query.category as string) || undefined,
      featured: parseBool(req.query.featured),
      newArrival: parseBool(req.query.newArrival),
      flashSale: parseBool(req.query.flashSale),
      minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
      inStock: parseBool(req.query.inStock),
      sort: (req.query.sort as never) || undefined,
      page,
      limit,
    });
    return res.json({ success: true, products: result.data, data: result.data, pagination: result.pagination, ...result.pagination });
  })
);

// ── Admin listing (includes inactive products) ──────────────────────────────
router.get(
  '/admin/all',
  authenticateAdmin,
  requirePermission('products:read'),
  asyncHandler(async (req, res) => {
    const { page, limit } = paginate(req.query as Record<string, unknown>, 10);
    const result = await listProducts({
      search: (req.query.search as string) || undefined,
      categoryId: req.query.categoryId ? Number(req.query.categoryId) : undefined,
      featured: parseBool(req.query.featured),
      includeInactive: true,
      sort: (req.query.sort as never) || 'newest',
      page,
      limit,
    });
    return res.json({ success: true, products: result.data, data: result.data, pagination: result.pagination, ...result.pagination });
  })
);

router.get(
  '/admin/summary',
  authenticateAdmin,
  asyncHandler(async (_req, res) => {
    const [total] = await db.select({ value: count() }).from(products);
    const [active] = await db.select({ value: count() }).from(products).where(eq(products.isActive, true));
    const low = await db
      .select({ id: products.id, name: products.name, stock: products.stock })
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(products.stock)
      .limit(10);
    return res.json({ success: true, total: Number(total.value), active: Number(active.value), lowStock: low });
  })
);

// ── Single product (id or slug) ─────────────────────────────────────────────
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const product = await getProductDetail(String(req.params.id));
    if (!product) throw new AppError('পণ্যটি পাওয়া যায়নি।', 404);
    return res.json({ success: true, product, data: product });
  })
);

// ── Admin CRUD ──────────────────────────────────────────────────────────────
router.post(
  '/',
  authenticateAdmin,
  requirePermission('products:write'),
  validateBody(productSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof productSchema>;
    const payload = normalizeProductPayload(input);
    if (payload.categoryId) {
      const [cat] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, payload.categoryId)).limit(1);
      if (!cat) throw new AppError('নির্বাচিত ক্যাটাগরি পাওয়া যায়নি।', 422);
    }
    const sku = input.sku?.trim() || (await nextProductSku());
    const slugBase = input.slug?.trim() || slugify(input.name);
    let slug = slugBase;
    for (let i = 2; i < 50; i += 1) {
      const [clash] = await db.select({ id: products.id }).from(products).where(eq(products.slug, slug)).limit(1);
      if (!clash) break;
      slug = `${slugBase}-${i}`;
    }

    const created = await db.transaction(async (tx) => {
      const [row] = await tx.insert(products).values({ ...payload, sku, slug }).returning();
      await replaceProductImages(tx as never, row.id, imageList(input));
      await tx.insert(inventory).values({ productId: row.id, quantity: row.stock, availableQuantity: row.stock }).onConflictDoNothing();
      await tx.insert(inventoryLog).values({
        productId: row.id, type: 'purchase', quantity: row.stock,
        previousStock: 0, newStock: row.stock, reason: 'Initial stock', adminId: req.adminId,
      });
      return row;
    });

    await logStaffAction({ adminId: req.adminId, action: 'product.create', module: 'products', targetId: created.id, details: { name: created.name }, ip: req.ip });
    const dto = await getProductDetail(String(created.id));
    return res.status(201).json({ success: true, message: 'পণ্য তৈরি হয়েছে।', product: dto, data: dto });
  })
);

router.put(
  '/:id',
  authenticateAdmin,
  requirePermission('products:write'),
  validateBody(productSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!existing) throw new AppError('পণ্যটি পাওয়া যায়নি।', 404);

    const input = req.body as z.infer<typeof productSchema>;
    const payload = normalizeProductPayload(input);
    if (payload.categoryId) {
      const [cat] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, payload.categoryId)).limit(1);
      if (!cat) throw new AppError('নির্বাচিত ক্যাটাগরি পাওয়া যায়নি।', 422);
    }

    await db.transaction(async (tx) => {
      await tx.update(products).set(payload).where(eq(products.id, id));
      if (input.images !== undefined || input.imageUrl !== undefined) {
        await replaceProductImages(tx as never, id, imageList(input));
      }
      if (payload.stock !== existing.stock) {
        await tx.insert(inventoryLog).values({
          productId: id, type: 'adjustment', quantity: payload.stock - existing.stock,
          previousStock: existing.stock, newStock: payload.stock, reason: 'Product edit', adminId: req.adminId,
        });
      }
    });

    await logStaffAction({ adminId: req.adminId, action: 'product.update', module: 'products', targetId: id, details: { name: payload.name }, ip: req.ip });
    const dto = await getProductDetail(String(id));
    return res.json({ success: true, message: 'পণ্য আপডেট হয়েছে।', product: dto, data: dto });
  })
);

router.patch(
  '/:id/toggle',
  authenticateAdmin,
  requirePermission('products:write'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!existing) throw new AppError('পণ্যটি পাওয়া যায়নি।', 404);
    const [updated] = await db
      .update(products)
      .set({ isActive: !existing.isActive, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    await logStaffAction({ adminId: req.adminId, action: 'product.toggle', module: 'products', targetId: id, details: { isActive: updated.isActive }, ip: req.ip });
    return res.json({ success: true, message: updated.isActive ? 'পণ্যটি সক্রিয় করা হয়েছে।' : 'পণ্যটি নিষ্ক্রিয় করা হয়েছে।', data: updated });
  })
);

router.delete(
  '/:id',
  authenticateAdmin,
  requirePermission('products:write'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!existing) throw new AppError('পণ্যটি পাওয়া যায়নি।', 404);
    // Soft delete: existing orders keep their snapshot, and history stays intact.
    await db.update(products).set({ isActive: false, updatedAt: new Date() }).where(eq(products.id, id));
    await logStaffAction({ adminId: req.adminId, action: 'product.deactivate', module: 'products', targetId: id, ip: req.ip });
    return res.json({ success: true, message: 'পণ্যটি নিষ্ক্রিয় (আর্কাইভ) করা হয়েছে।' });
  })
);

export default router;
