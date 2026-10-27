import { Router } from 'express';
import { and, count, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../config/db';
import { categories, products } from '../schemas/index';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticateAdmin, optionalAdminAuth, requirePermission } from '../middleware/adminAuth';
import { validateBody } from '../middleware/validate';
import { logStaffAction } from '../services/audit.service';
import { slugify } from '../utils/helpers';

const router = Router();

const categorySchema = z.object({
  name: z.string().trim().min(2, 'ক্যাটাগরির নাম দিন।').max(255),
  nameBn: z.string().trim().max(255).optional(),
  slug: z.string().trim().optional(),
  description: z.string().optional().nullable(),
  image: z.string().trim().optional().nullable(),
  imageUrl: z.string().trim().optional().nullable(),
  parentId: z.coerce.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

/**
 * Public list. When a valid admin token is supplied inactive categories are
 * included so the admin table can manage them.
 */
router.get(
  '/',
  optionalAdminAuth,
  asyncHandler(async (req, res) => {
    const includeInactive = Boolean(req.adminId) || req.query.includeInactive === 'true';
    const rows = await db
      .select()
      .from(categories)
      .where(includeInactive ? undefined : eq(categories.isActive, true))
      .orderBy(categories.sortOrder, categories.name);
    const counts = await db
      .select({ categoryId: products.categoryId, value: count() })
      .from(products)
      .where(eq(products.isActive, true))
      .groupBy(products.categoryId);
    const data = rows.map((c) => ({
      ...c,
      productCount: Number(counts.find((x) => x.categoryId === c.id)?.value ?? 0),
      image: c.image ?? null,
    }));
    return res.json({ success: true, categories: data, data });
  })
);

router.post(
  '/',
  authenticateAdmin,
  requirePermission('categories:write'),
  validateBody(categorySchema),
  asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof categorySchema>;
    // Precedence: an uploaded image wins over a pasted URL.
    const image = (input.image || input.imageUrl || null) as string | null;
    const base = input.slug?.trim() || slugify(input.name);
    let slug = base;
    for (let i = 2; i < 50; i += 1) {
      const [clash] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug)).limit(1);
      if (!clash) break;
      slug = `${base}-${i}`;
    }
    const [created] = await db
      .insert(categories)
      .values({
        name: input.name,
        nameBn: input.nameBn ?? null,
        slug,
        description: input.description ?? null,
        image,
        parentId: input.parentId ?? null,
        isActive: input.isActive ?? true,
        isFeatured: input.isFeatured ?? false,
        sortOrder: input.sortOrder ?? 0,
      })
      .returning();
    await logStaffAction({ adminId: req.adminId, action: 'category.create', module: 'categories', targetId: created.id, ip: req.ip });
    return res.status(201).json({ success: true, message: 'ক্যাটাগরি তৈরি হয়েছে।', data: created, category: created });
  })
);

router.put(
  '/:id',
  authenticateAdmin,
  requirePermission('categories:write'),
  validateBody(categorySchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const input = req.body as z.infer<typeof categorySchema>;
    const [existing] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
    if (!existing) throw new AppError('ক্যাটাগরিটি পাওয়া যায়নি।', 404);

    const image = input.image || input.imageUrl || existing.image || null;
    const slug = input.slug?.trim() || (input.name !== existing.name ? slugify(input.name) : existing.slug);
    const [clash] = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.slug, slug))).limit(1);
    if (clash && clash.id !== id) throw new AppError('এই স্লাগ ইতিমধ্যে ব্যবহৃত হচ্ছে।', 409);

    const [updated] = await db
      .update(categories)
      .set({
        name: input.name,
        nameBn: input.nameBn ?? existing.nameBn,
        slug,
        description: input.description ?? existing.description,
        image,
        parentId: input.parentId ?? existing.parentId,
        isActive: input.isActive ?? existing.isActive,
        isFeatured: input.isFeatured ?? existing.isFeatured,
        sortOrder: input.sortOrder ?? existing.sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(categories.id, id))
      .returning();
    await logStaffAction({ adminId: req.adminId, action: 'category.update', module: 'categories', targetId: id, ip: req.ip });
    return res.json({ success: true, message: 'ক্যাটাগরি আপডেট হয়েছে।', data: updated, category: updated });
  })
);

router.delete(
  '/:id',
  authenticateAdmin,
  requirePermission('categories:write'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
    if (!existing) throw new AppError('ক্যাটাগরিটি পাওয়া যায়নি।', 404);
    const [{ value }] = await db.select({ value: count() }).from(products).where(eq(products.categoryId, id));
    if (Number(value) > 0) {
      // Products would be orphaned by a hard delete → deactivate instead.
      await db.update(categories).set({ isActive: false, updatedAt: new Date() }).where(eq(categories.id, id));
      return res.json({
        success: true,
        message: `এই ক্যাটাগরিতে ${value} টি পণ্য আছে, তাই ক্যাটাগরিটি নিষ্ক্রিয় করা হয়েছে (মুছে ফেলা হয়নি)।`,
      });
    }
    await db.delete(categories).where(eq(categories.id, id));
    await logStaffAction({ adminId: req.adminId, action: 'category.delete', module: 'categories', targetId: id, ip: req.ip });
    return res.json({ success: true, message: 'ক্যাটাগরি মুছে ফেলা হয়েছে।' });
  })
);

export default router;
