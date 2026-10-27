import { Router } from 'express';
import { and, count, desc, eq } from 'drizzle-orm';
import { db } from '../config/db';
import { notifications } from '../schemas/index';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const limit = Math.min(50, Number(req.query.limit ?? 20));
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, req.userId!))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
    const [unread] = await db
      .select({ value: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, req.userId!), eq(notifications.isRead, false)));
    return res.json({ success: true, notifications: rows, data: rows, unread: Number(unread?.value ?? 0) });
  })
);

router.put(
  '/:id/read',
  asyncHandler(async (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    const [updated] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, req.userId!)))
      .returning();
    if (!updated) throw new AppError('নোটিফিকেশন পাওয়া যায়নি।', 404);
    return res.json({ success: true, message: 'পঠিত হিসেবে চিহ্নিত করা হয়েছে।', data: updated });
  })
);

router.put(
  '/read-all',
  asyncHandler(async (req: AuthRequest, res) => {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, req.userId!));
    return res.json({ success: true, message: 'সব নোটিফিকেশন পঠিত হয়েছে।' });
  })
);

export default router;
