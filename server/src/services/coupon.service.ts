import { and, count, eq } from 'drizzle-orm';
import { db } from '../config/db';
import type { DbClient } from '../config/db';
import { coupons, couponUsages } from '../schemas/index';
import { AppError } from '../middleware/errorHandler';
import { computeDiscount } from './pricing';

export interface CouponValidationResult {
  couponId: number;
  code: string;
  type: 'percentage' | 'flat' | 'free_shipping';
  discount: number;
  freeShipping: boolean;
  description: string | null;
  minOrderAmount: number | null;
  expiresAt: string;
}

/**
 * Server-side coupon validation: status, window, minimum order, total usage
 * limit and per-customer usage limit. Never trusts a client-supplied discount.
 */
export async function validateCoupon(
  code: string,
  subtotal: number,
  userId: number | null,
  dbc: DbClient = db
): Promise<CouponValidationResult> {
  const normalized = String(code ?? '').trim().toUpperCase();
  if (!normalized) throw new AppError('কুপন কোড দিন।', 400);

  const [coupon] = await dbc.select().from(coupons).where(eq(coupons.code, normalized)).limit(1);
  if (!coupon) throw new AppError('কুপন কোডটি সঠিক নয়।', 404);
  if (!coupon.isActive) throw new AppError('এই কুপনটি বর্তমানে নিষ্ক্রিয়।', 400);

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) throw new AppError('এই কুপনের মেয়াদ এখনো শুরু হয়নি।', 400);
  if (coupon.expiryDate && coupon.expiryDate < now) throw new AppError('এই কুপনের মেয়াদ শেষ হয়েছে।', 400);
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    throw new AppError('এই কুপনের ব্যবহারের সীমা শেষ হয়েছে।', 400);
  }

  const minOrder = coupon.minOrderAmount == null ? 0 : Number(coupon.minOrderAmount);
  if (subtotal < minOrder) {
    throw new AppError(`এই কুপন ব্যবহারে সর্বনিম্ন ৳${minOrder} টাকার অর্ডার প্রয়োজন।`, 400);
  }

  if (userId && coupon.maxUsesPerUser) {
    const [{ value }] = await dbc
      .select({ value: count() })
      .from(couponUsages)
      .where(and(eq(couponUsages.couponId, coupon.id), eq(couponUsages.userId, userId)));
    if (Number(value) >= coupon.maxUsesPerUser) {
      throw new AppError('আপনি ইতিমধ্যে এই কুপনটি ব্যবহার করেছেন।', 400);
    }
  }

  const discount = computeDiscount(
    {
      type: coupon.type as 'percentage' | 'flat' | 'free_shipping',
      value: Number(coupon.value),
      maxDiscountAmount: coupon.maxDiscountAmount == null ? null : Number(coupon.maxDiscountAmount),
      minOrderAmount: minOrder,
    },
    subtotal
  );

  return {
    couponId: coupon.id,
    code: coupon.code,
    type: coupon.type as 'percentage' | 'flat' | 'free_shipping',
    discount,
    freeShipping: coupon.type === 'free_shipping',
    description: coupon.description ?? null,
    minOrderAmount: coupon.minOrderAmount == null ? null : Number(coupon.minOrderAmount),
    expiresAt: coupon.expiryDate.toISOString(),
  };
}

/** Records a redemption inside the caller's transaction. */
export async function recordCouponUsage(
  dbc: DbClient,
  input: { couponId: number; userId: number | null; orderId: number; discount: number }
): Promise<void> {
  await dbc.insert(couponUsages).values({
    couponId: input.couponId,
    userId: input.userId ?? null,
    orderId: input.orderId,
    discount: String(input.discount),
  });
  const [row] = await dbc.select({ usedCount: coupons.usedCount }).from(coupons).where(eq(coupons.id, input.couponId)).limit(1);
  await dbc
    .update(coupons)
    .set({ usedCount: (row?.usedCount ?? 0) + 1, updatedAt: new Date() })
    .where(eq(coupons.id, input.couponId));
}
