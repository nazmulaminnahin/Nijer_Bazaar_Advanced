import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../config/db';
import { categories, contactMessages, coupons, testimonials } from '../schemas/index';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { getPublicSettings, loadShippingConfig, toNumber } from '../services/settings.service';
import { quoteShipping } from '../services/pricing';
import { BD_DIVISIONS } from '../config/bd-geo';
import { rateLimit } from '../middleware/rateLimit';
import { isValidBdPhone, normalizePhone } from '../utils/helpers';

const router = Router();

/** Branding / header / footer / shipping policy for the storefront. */
router.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    const settings = await getPublicSettings();
    return res.json({ success: true, settings, data: settings });
  })
);

router.get(
  '/geo',
  asyncHandler(async (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.json({ success: true, divisions: BD_DIVISIONS, data: BD_DIVISIONS });
  })
);

/** Deterministic shipping quote used by the cart and checkout pages. */
router.get(
  '/shipping/quote',
  asyncHandler(async (req, res) => {
    const subtotal = toNumber(String(req.query.subtotal ?? '0'), 0);
    const district = String(req.query.district ?? 'Dhaka');
    const config = await loadShippingConfig();
    const quote = quoteShipping({ district, subtotal, config });
    return res.json({ success: true, quote, data: quote });
  })
);

/** Published testimonials only — nothing is fabricated or auto-approved. */
router.get(
  '/testimonials',
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select()
      .from(testimonials)
      .where(eq(testimonials.isPublished, true))
      .orderBy(testimonials.sortOrder, desc(testimonials.createdAt));
    return res.json({ success: true, testimonials: rows, data: rows });
  })
);

/** Active coupons for the storefront banner (codes and terms only). */
router.get(
  '/coupons/active',
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const rows = await db.select().from(coupons).where(eq(coupons.isActive, true));
    const data = rows
      .filter((c) => c.startsAt <= now && c.expiryDate >= now && (c.maxUses == null || c.usedCount < c.maxUses))
      .map((c) => ({
        code: c.code,
        description: c.description,
        type: c.type,
        value: Number(c.value),
        minOrderAmount: c.minOrderAmount == null ? null : Number(c.minOrderAmount),
        maxDiscountAmount: c.maxDiscountAmount == null ? null : Number(c.maxDiscountAmount),
        expiresAt: c.expiryDate.toISOString(),
      }));
    return res.json({ success: true, coupons: data, data });
  })
);

router.get(
  '/categories/featured',
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select()
      .from(categories)
      .where(and(eq(categories.isActive, true), eq(categories.isFeatured, true)))
      .orderBy(categories.sortOrder);
    return res.json({ success: true, categories: rows, data: rows });
  })
);

export default router;

/** Contact form — stored in the database, never silently "sent" anywhere. */
router.post(
  '/contact',
  rateLimit({ windowMs: 60 * 60_000, max: 10, keyPrefix: 'contact:' }),
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const name = String(body.name ?? '').trim();
    const phone = normalizePhone(String(body.phone ?? ''));
    const message = String(body.message ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    const subject = String(body.subject ?? '').trim();

    if (name.length < 2) throw new AppError('নাম লিখুন।', 422);
    if (!phone || !isValidBdPhone(phone)) throw new AppError('সঠিক মোবাইল নম্বর দিন।', 422);
    if (message.length < 5) throw new AppError('বার্তাটি লিখুন (কমপক্ষে ৫ অক্ষর)।', 422);

    const [created] = await db
      .insert(contactMessages)
      .values({
        name,
        phone,
        email: email || null,
        subject: subject || null,
        message,
        userId: (req as { userId?: number }).userId ?? null,
      })
      .returning({ id: contactMessages.id, createdAt: contactMessages.createdAt });

    return res.status(201).json({
      success: true,
      message: 'আপনার বার্তা পেয়েছি। গ্রাহকসেবা দল শীঘ্রই যোগাযোগ করবে।',
      id: created?.id,
    });
  })
);
