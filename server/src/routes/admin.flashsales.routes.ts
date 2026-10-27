import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../config/db';
import { flashSales } from '../schemas/index';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticateAdmin, requirePermission } from '../middleware/adminAuth';
import { validateBody } from '../middleware/validate';
import { logStaffAction } from '../services/audit.service';

const router = Router();
router.use(authenticateAdmin);

function serialize(row: typeof flashSales.$inferSelect) {
  const now = new Date();
  const status = !row.isActive ? 'inactive' : row.startAt > now ? 'scheduled' : row.endAt < now ? 'expired' : 'active';
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.type,
    value: Number(row.value),
    productIds: row.productIds ?? [],
    categoryIds: row.categoryIds ?? [],
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    stockLimit: row.stockLimit,
    isActive: row.isActive,
    status,
    createdAt: row.createdAt.toISOString(),
  };
}

router.get(
  '/',
  requirePermission('flashsales:read'),
  asyncHandler(async (_req, res) => {
    const rows = await db.select().from(flashSales).orderBy(desc(flashSales.createdAt));
    const data = rows.map(serialize);
    return res.json({ success: true, flashSales: data, data });
  })
);

const schema = z.object({
  title: z.string().trim().min(3, 'শিরোনাম দিন।').max(255),
  description: z.string().trim().max(1000).optional(),
  type: z.enum(['percentage', 'flat']).default('percentage'),
  value: z.coerce.number().positive('ডিসকাউন্ট মান দিন।'),
  productIds: z.array(z.coerce.number().int().positive()).default([]),
  categoryIds: z.array(z.coerce.number().int().positive()).default([]),
  startAt: z.string().trim(),
  endAt: z.string().trim(),
  stockLimit: z.coerce.number().int().min(1).optional().nullable(),
  isActive: z.boolean().optional(),
});

function validateWindow(input: z.infer<typeof schema>) {
  if (input.type === 'percentage' && input.value > 100) throw new AppError('শতকরা ছাড় ১০০ এর বেশি হতে পারে না।', 422);
  const start = new Date(input.startAt);
  const end = new Date(input.endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new AppError('শুরুর ও শেষের সময় সঠিক নয়।', 422);
  if (end <= start) throw new AppError('শেষের সময় শুরুর সময়ের পরে হতে হবে।', 422);
  if (!input.productIds.length && !input.categoryIds.length) {
    throw new AppError('অন্তত একটি পণ্য অথবা ক্যাটাগরি নির্বাচন করুন।', 422);
  }
  return { start, end };
}

router.post(
  '/',
  requirePermission('flashsales:write'),
  validateBody(schema),
  asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof schema>;
    const { start, end } = validateWindow(input);
    const [created] = await db
      .insert(flashSales)
      .values({
        title: input.title,
        description: input.description ?? null,
        type: input.type,
        value: String(input.value),
        productIds: input.productIds,
        categoryIds: input.categoryIds,
        startAt: start,
        endAt: end,
        stockLimit: input.stockLimit ?? null,
        isActive: input.isActive ?? true,
        createdBy: req.adminId,
      })
      .returning();
    await logStaffAction({ adminId: req.adminId, action: 'flashsale.create', module: 'flashsales', targetId: created.id, ip: req.ip });
    return res.status(201).json({ success: true, message: 'ফ্ল্যাশ সেল তৈরি হয়েছে।', data: serialize(created), flashSale: serialize(created) });
  })
);

router.put(
  '/:id',
  requirePermission('flashsales:write'),
  validateBody(schema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const input = req.body as z.infer<typeof schema>;
    const [existing] = await db.select().from(flashSales).where(eq(flashSales.id, id)).limit(1);
    if (!existing) throw new AppError('ফ্ল্যাশ সেল পাওয়া যায়নি।', 404);
    const { start, end } = validateWindow(input);
    const [updated] = await db
      .update(flashSales)
      .set({
        title: input.title,
        description: input.description ?? existing.description,
        type: input.type,
        value: String(input.value),
        productIds: input.productIds,
        categoryIds: input.categoryIds,
        startAt: start,
        endAt: end,
        stockLimit: input.stockLimit ?? null,
        isActive: input.isActive ?? existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(flashSales.id, id))
      .returning();
    return res.json({ success: true, message: 'ফ্ল্যাশ সেল আপডেট হয়েছে।', data: serialize(updated), flashSale: serialize(updated) });
  })
);

router.patch(
  '/:id/toggle',
  requirePermission('flashsales:write'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(flashSales).where(eq(flashSales.id, id)).limit(1);
    if (!existing) throw new AppError('ফ্ল্যাশ সেল পাওয়া যায়নি।', 404);
    const [updated] = await db.update(flashSales).set({ isActive: !existing.isActive, updatedAt: new Date() }).where(eq(flashSales.id, id)).returning();
    return res.json({
      success: true,
      message: updated.isActive ? 'ফ্ল্যাশ সেল চালু হয়েছে।' : 'ফ্ল্যাশ সেল বন্ধ করা হয়েছে।',
      data: serialize(updated),
    });
  })
);

router.delete(
  '/:id',
  requirePermission('flashsales:write'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(flashSales).where(eq(flashSales.id, id)).limit(1);
    if (!existing) throw new AppError('ফ্ল্যাশ সেল পাওয়া যায়নি।', 404);
    await db.update(flashSales).set({ isActive: false, updatedAt: new Date() }).where(eq(flashSales.id, id));
    return res.json({ success: true, message: 'ফ্ল্যাশ সেল বন্ধ (আর্কাইভ) করা হয়েছে।' });
  })
);

/** Live campaign for the storefront (never advertises expired/future ones). */
router.get(
  '/active',
  requirePermission('flashsales:read'),
  asyncHandler(async (_req, res) => {
    const rows = await db.select().from(flashSales).where(eq(flashSales.isActive, true));
    const now = new Date();
    const live = rows.filter((r) => r.startAt <= now && r.endAt >= now).map(serialize);
    return res.json({ success: true, flashSales: live, data: live });
  })
);

export default router;
