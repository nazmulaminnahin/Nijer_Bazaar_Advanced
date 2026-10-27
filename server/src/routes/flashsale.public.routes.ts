import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../config/db';
import { flashSales } from '../schemas/index';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

/** Public: the single best active campaign (used by the homepage countdown). */
router.get(
  '/active',
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const rows = await db.select().from(flashSales).where(eq(flashSales.isActive, true));
    const live = rows
      .filter((r) => r.startAt <= now && r.endAt >= now)
      .sort((a, b) => a.endAt.getTime() - b.endAt.getTime());
    const data = live.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      type: r.type,
      value: Number(r.value),
      productIds: r.productIds ?? [],
      categoryIds: r.categoryIds ?? [],
      startAt: r.startAt.toISOString(),
      endAt: r.endAt.toISOString(),
    }));
    return res.json({ success: true, flashSales: data, data, current: data[0] ?? null });
  })
);

export default router;
