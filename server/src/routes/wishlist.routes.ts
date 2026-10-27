import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../config/db';
import { wishlist } from '../schemas/index';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getProductDetail } from '../services/product.service';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const rows = await db
      .select({ productId: wishlist.productId, createdAt: wishlist.createdAt })
      .from(wishlist)
      .where(eq(wishlist.userId, req.userId!))
      .orderBy(desc(wishlist.createdAt));

    const items = [];
    for (const row of rows) {
      const product = await getProductDetail(String(row.productId));
      if (product) items.push({ ...product, wishlistedAt: row.createdAt.toISOString() });
    }
    return res.json({
      success: true,
      wishlist: items,
      data: items,
      productIds: rows.map((r) => r.productId),
    });
  })
);

router.get(
  '/ids',
  asyncHandler(async (req: AuthRequest, res) => {
    const rows = await db.select({ productId: wishlist.productId }).from(wishlist).where(eq(wishlist.userId, req.userId!));
    return res.json({ success: true, productIds: rows.map((r) => r.productId), data: rows.map((r) => r.productId) });
  })
);

router.post(
  '/:productId',
  asyncHandler(async (req: AuthRequest, res) => {
    const productId = Number(req.params.productId);
    if (!Number.isInteger(productId) || productId <= 0) throw new AppError('Invalid product.', 400);
    const product = await getProductDetail(String(productId));
    if (!product) throw new AppError('পণ্যটি পাওয়া যায়নি।', 404);

    const existing = await db
      .select({ id: wishlist.id })
      .from(wishlist)
      .where(and(eq(wishlist.userId, req.userId!), eq(wishlist.productId, productId)))
      .limit(1);

    if (existing.length) {
      await db.delete(wishlist).where(eq(wishlist.id, existing[0].id));
      return res.json({ success: true, wishlisted: false, message: 'উইশলিস্ট থেকে সরানো হয়েছে।' });
    }
    await db.insert(wishlist).values({ userId: req.userId!, productId });
    return res.json({ success: true, wishlisted: true, message: 'উইশলিস্টে যোগ করা হয়েছে।' });
  })
);

router.delete(
  '/:productId',
  asyncHandler(async (req: AuthRequest, res) => {
    const productId = Number(req.params.productId);
    await db.delete(wishlist).where(and(eq(wishlist.userId, req.userId!), eq(wishlist.productId, productId)));
    return res.json({ success: true, wishlisted: false, message: 'উইশলিস্ট থেকে সরানো হয়েছে।' });
  })
);

export default router;
