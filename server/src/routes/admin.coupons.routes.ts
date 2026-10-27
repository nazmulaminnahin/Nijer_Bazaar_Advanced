import { Router } from 'express';
import { and, count, desc, eq, ilike, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../config/db';
import { couponUsages, coupons } from '../schemas/index';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticateAdmin, requirePermission } from '../middleware/adminAuth';
import { validateBody } from '../middleware/validate';
import { validateCoupon } from '../services/coupon.service';
import { getSettings } from '../services/settings.service';
import { renderCouponSvg, svgToPng } from '../services/card.service';
import { generateCouponCode, paginate } from '../utils/helpers';
import { logStaffAction } from '../services/audit.service';

const router = Router();

function serialize(c: typeof coupons.$inferSelect) {
  const now = new Date();
  const expired = c.expiryDate < now;
  const upcoming = c.startsAt > now;
  const exhausted = c.maxUses != null && c.usedCount >= c.maxUses;
  return {
    id: c.id,
    code: c.code,
    description: c.description,
    type: c.type,
    value: Number(c.value),
    minOrderAmount: c.minOrderAmount == null ? null : Number(c.minOrderAmount),
    maxDiscount: c.maxDiscountAmount == null ? null : Number(c.maxDiscountAmount),
    maxDiscountAmount: c.maxDiscountAmount == null ? null : Number(c.maxDiscountAmount),
    usageLimit: c.maxUses,
    maxUses: c.maxUses,
    maxUsesPerUser: c.maxUsesPerUser,
    usedCount: c.usedCount,
    usageCount: c.usedCount,
    startsAt: c.startsAt.toISOString(),
    expiresAt: c.expiryDate.toISOString(),
    isActive: c.isActive,
    status: !c.isActive ? 'inactive' : expired ? 'expired' : upcoming ? 'scheduled' : exhausted ? 'exhausted' : 'active',
    terms: c.terms,
    createdAt: c.createdAt.toISOString(),
  };
}

// Public validation is mounted separately (see index.ts) — this one is admin-only.
router.get(
  '/',
  authenticateAdmin,
  requirePermission('coupons:read'),
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = paginate(req.query as Record<string, unknown>, 20);
    const search = String(req.query.search ?? '').trim();
    const where = search ? or(ilike(coupons.code, `%${search}%`), ilike(coupons.description, `%${search}%`)) : undefined;
    const [totalRow] = await db.select({ value: count() }).from(coupons).where(where);
    const rows = await db.select().from(coupons).where(where).orderBy(desc(coupons.createdAt)).limit(limit).offset(offset);
    const total = Number(totalRow?.value ?? 0);
    return res.json({
      success: true,
      coupons: rows.map(serialize),
      data: rows.map(serialize),
      total,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  })
);

const couponSchema = z.object({
  code: z.string().trim().max(50).optional(),
  description: z.string().trim().max(500).optional(),
  type: z.enum(['percentage', 'flat', 'free_shipping']).default('percentage'),
  value: z.coerce.number().min(0).default(0),
  minOrderAmount: z.coerce.number().min(0).optional().nullable(),
  maxDiscount: z.coerce.number().min(0).optional().nullable(),
  usageLimit: z.coerce.number().int().min(1).optional().nullable(),
  maxUsesPerUser: z.coerce.number().int().min(1).max(100).optional(),
  startsAt: z.string().trim().optional(),
  expiresAt: z.string().trim().optional(),
  isActive: z.boolean().optional(),
  terms: z.string().trim().max(1000).optional(),
});

function validateCouponInput(input: z.infer<typeof couponSchema>) {
  if (input.type === 'percentage' && (input.value <= 0 || input.value > 100)) {
    throw new AppError('শতকরা ডিসকাউন্ট ১ থেকে ১০০ এর মধ্যে হতে হবে।', 422);
  }
  if (input.type === 'flat' && input.value <= 0) throw new AppError('ডিসকাউন্টের পরিমাণ দিন।', 422);
  const starts = input.startsAt ? new Date(input.startsAt) : new Date();
  if (Number.isNaN(starts.getTime())) throw new AppError('শুরুর তারিখ সঠিক নয়।', 422);
  const expiry = input.expiresAt ? new Date(input.expiresAt) : new Date(Date.now() + 30 * 86_400_000);
  if (Number.isNaN(expiry.getTime())) throw new AppError('মেয়াদের তারিখ সঠিক নয়।', 422);
  if (expiry <= starts) throw new AppError('মেয়াদের তারিখ শুরুর তারিখের পরে হতে হবে।', 422);
  return { starts, expiry };
}

router.post(
  '/',
  authenticateAdmin,
  requirePermission('coupons:write'),
  validateBody(couponSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof couponSchema>;
    const { starts, expiry } = validateCouponInput(input);
    let code = (input.code || generateCouponCode()).trim().toUpperCase();
    const [clash] = await db.select({ id: coupons.id }).from(coupons).where(eq(coupons.code, code)).limit(1);
    if (clash) throw new AppError('এই কুপন কোড ইতিমধ্যে আছে।', 409);

    const [created] = await db
      .insert(coupons)
      .values({
        code,
        description: input.description ?? null,
        type: input.type,
        value: String(input.value),
        minOrderAmount: input.minOrderAmount == null ? null : String(input.minOrderAmount),
        maxDiscountAmount: input.maxDiscount == null ? null : String(input.maxDiscount),
        maxUses: input.usageLimit ?? null,
        maxUsesPerUser: input.maxUsesPerUser ?? 1,
        startsAt: starts,
        expiryDate: expiry,
        isActive: input.isActive ?? true,
        terms: input.terms ?? null,
        createdBy: req.adminId,
      })
      .returning();
    await logStaffAction({ adminId: req.adminId, action: 'coupon.create', module: 'coupons', targetId: created.id, details: { code }, ip: req.ip });
    return res.status(201).json({ success: true, message: 'কুপন তৈরি হয়েছে।', coupon: serialize(created), data: serialize(created) });
  })
);

router.put(
  '/:id',
  authenticateAdmin,
  requirePermission('coupons:write'),
  validateBody(couponSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const input = req.body as z.infer<typeof couponSchema>;
    const [existing] = await db.select().from(coupons).where(eq(coupons.id, id)).limit(1);
    if (!existing) throw new AppError('কুপন পাওয়া যায়নি।', 404);
    const { starts, expiry } = validateCouponInput(input);

    const code = (input.code ?? existing.code).trim().toUpperCase();
    if (code !== existing.code) {
      const [clash] = await db.select({ id: coupons.id }).from(coupons).where(eq(coupons.code, code)).limit(1);
      if (clash) throw new AppError('এই কুপন কোড ইতিমধ্যে আছে।', 409);
    }

    const [updated] = await db
      .update(coupons)
      .set({
        code,
        description: input.description ?? existing.description,
        type: input.type,
        value: String(input.value),
        minOrderAmount: input.minOrderAmount == null ? null : String(input.minOrderAmount),
        maxDiscountAmount: input.maxDiscount == null ? null : String(input.maxDiscount),
        maxUses: input.usageLimit ?? null,
        maxUsesPerUser: input.maxUsesPerUser ?? existing.maxUsesPerUser,
        startsAt: starts,
        expiryDate: expiry,
        isActive: input.isActive ?? existing.isActive,
        terms: input.terms ?? existing.terms,
        updatedAt: new Date(),
      })
      .where(eq(coupons.id, id))
      .returning();
    return res.json({ success: true, message: 'কুপন আপডেট হয়েছে।', coupon: serialize(updated), data: serialize(updated) });
  })
);

router.patch(
  '/:id/toggle',
  authenticateAdmin,
  requirePermission('coupons:write'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(coupons).where(eq(coupons.id, id)).limit(1);
    if (!existing) throw new AppError('কুপন পাওয়া যায়নি।', 404);
    const [updated] = await db.update(coupons).set({ isActive: !existing.isActive, updatedAt: new Date() }).where(eq(coupons.id, id)).returning();
    return res.json({ success: true, message: updated.isActive ? 'কুপন সক্রিয় করা হয়েছে।' : 'কুপন নিষ্ক্রিয় করা হয়েছে।', data: serialize(updated) });
  })
);

router.delete(
  '/:id',
  authenticateAdmin,
  requirePermission('coupons:write'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [usage] = await db.select({ value: count() }).from(couponUsages).where(eq(couponUsages.couponId, id));
    if (Number(usage?.value ?? 0) > 0) {
      await db.update(coupons).set({ isActive: false, updatedAt: new Date() }).where(eq(coupons.id, id));
      return res.json({ success: true, message: 'কুপনটি ব্যবহৃত হয়েছে, তাই মুছে না ফেলে নিষ্ক্রিয় করা হয়েছে।' });
    }
    await db.delete(coupons).where(eq(coupons.id, id));
    await logStaffAction({ adminId: req.adminId, action: 'coupon.delete', module: 'coupons', targetId: id, ip: req.ip });
    return res.json({ success: true, message: 'কুপন মুছে ফেলা হয়েছে।' });
  })
);

/** Coupon artwork preview / download with the configured terms. */
router.get(
  '/:id/design',
  authenticateAdmin,
  requirePermission('coupons:read'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [coupon] = await db.select().from(coupons).where(eq(coupons.id, id)).limit(1);
    if (!coupon) throw new AppError('কুপন পাওয়া যায়নি।', 404);
    const settings = await getSettings();
    const svg = await renderCouponSvg({
      code: coupon.code,
      type: coupon.type as 'percentage' | 'flat' | 'free_shipping',
      value: Number(coupon.value),
      minOrderAmount: coupon.minOrderAmount == null ? null : Number(coupon.minOrderAmount),
      expiresAt: coupon.expiryDate.toISOString(),
      brand: { name: settings.site_name, nameBn: settings.site_name_bn, logo: settings.logo_url, currency: settings.currency_symbol },
      terms: coupon.terms,
    });
    const format = req.query.format === 'download' ? 'download' : req.query.format === 'png' ? 'png' : 'svg';
    if (format !== 'svg') {
      const png = await svgToPng(svg, 1400);
      res.setHeader('Content-Type', 'image/png');
      if (format === 'download') res.setHeader('Content-Disposition', `attachment; filename="coupon-${coupon.code}.png"`);
      return res.send(png);
    }
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.send(svg);
  })
);

export default router;
