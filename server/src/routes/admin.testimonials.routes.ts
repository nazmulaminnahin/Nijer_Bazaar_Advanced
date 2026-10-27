import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../config/db';
import { testimonials } from '../schemas/index';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticateAdmin, requirePermission } from '../middleware/adminAuth';
import { validateBody } from '../middleware/validate';

const router = Router();
router.use(authenticateAdmin);

const schema = z.object({
  name: z.string().trim().min(2, 'নাম দিন।').max(255),
  location: z.string().trim().max(255).optional(),
  rating: z.coerce.number().int().min(1).max(5).default(5),
  message: z.string().trim().min(10, 'রিভিউ কমপক্ষে ১০ অক্ষরের হতে হবে।').max(1000),
  avatar: z.string().trim().max(500).optional(),
  isPublished: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

router.get(
  '/',
  requirePermission('settings:read'),
  asyncHandler(async (_req, res) => {
    const rows = await db.select().from(testimonials).orderBy(testimonials.sortOrder, desc(testimonials.createdAt));
    return res.json({ success: true, testimonials: rows, data: rows });
  })
);

router.post(
  '/',
  requirePermission('settings:write'),
  validateBody(schema),
  asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof schema>;
    const [created] = await db
      .insert(testimonials)
      .values({ ...input, isPublished: input.isPublished ?? false, createdBy: req.adminId })
      .returning();
    return res.status(201).json({ success: true, message: 'রিভিউ সংরক্ষণ করা হয়েছে।', data: created });
  })
);

router.put(
  '/:id',
  requirePermission('settings:write'),
  validateBody(schema.partial()),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(testimonials).where(eq(testimonials.id, id)).limit(1);
    if (!existing) throw new AppError('রিভিউ পাওয়া যায়নি।', 404);
    const input = req.body as Partial<z.infer<typeof schema>>;
    const [updated] = await db
      .update(testimonials)
      .set({
        name: input.name ?? existing.name,
        location: input.location ?? existing.location,
        rating: input.rating ?? existing.rating,
        message: input.message ?? existing.message,
        avatar: input.avatar ?? existing.avatar,
        isPublished: input.isPublished ?? existing.isPublished,
        sortOrder: input.sortOrder ?? existing.sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(testimonials.id, id))
      .returning();
    return res.json({ success: true, message: 'রিভিউ আপডেট হয়েছে।', data: updated });
  })
);

router.patch(
  '/:id/publish',
  requirePermission('settings:write'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(testimonials).where(eq(testimonials.id, id)).limit(1);
    if (!existing) throw new AppError('রিভিউ পাওয়া যায়নি।', 404);
    const [updated] = await db.update(testimonials).set({ isPublished: !existing.isPublished, updatedAt: new Date() }).where(eq(testimonials.id, id)).returning();
    return res.json({ success: true, message: updated.isPublished ? 'রিভিউ প্রকাশ করা হয়েছে।' : 'রিভিউ অপ্রকাশিত করা হয়েছে।', data: updated });
  })
);

router.delete(
  '/:id',
  requirePermission('settings:write'),
  asyncHandler(async (req, res) => {
    await db.delete(testimonials).where(eq(testimonials.id, Number(req.params.id)));
    return res.json({ success: true, message: 'রিভিউ মুছে ফেলা হয়েছে।' });
  })
);

export default router;
