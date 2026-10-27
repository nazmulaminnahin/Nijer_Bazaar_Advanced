import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../config/db';
import { giftCards } from '../schemas/index';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticateAdmin, requirePermission } from '../middleware/adminAuth';
import { validateBody } from '../middleware/validate';
import { paginate } from '../utils/helpers';
import {
  adjustGiftCardBalance, createGiftCards, giftCardLedger, listGiftCards, serializeGiftCard,
} from '../services/giftcard.service';
import { getSettings } from '../services/settings.service';
import { renderGiftCardBack, renderGiftCardFront, svgToPng } from '../services/card.service';
import { logStaffAction } from '../services/audit.service';

const router = Router();
router.use(authenticateAdmin, requirePermission('giftcards:read'));

const createSchema = z.object({
  amount: z.coerce.number().positive('পরিমাণ দিন।'),
  initialBalance: z.coerce.number().positive().optional(),
  quantity: z.coerce.number().int().min(1).max(50).default(1),
  expiresAt: z.string().trim().nullable().optional(),
  design: z.enum(['classic', 'festival', 'premium', 'eid']).default('classic'),
  recipientName: z.string().trim().max(255).optional(),
  recipientPhone: z.string().trim().max(20).optional(),
  message: z.string().trim().max(500).optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit } = paginate(req.query as Record<string, unknown>, 20);
    const result = await listGiftCards({
      page, limit,
      search: (req.query.search as string) || undefined,
      status: (req.query.status as string) || undefined,
    });
    return res.json({ success: true, cards: result.data, giftCards: result.data, data: result.data, total: result.total, pagination: result.pagination, summary: result.summary });
  })
);

router.post(
  '/',
  requirePermission('giftcards:write'),
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof createSchema>;
    const cards = await createGiftCards({
      amount: input.amount ?? input.initialBalance ?? 0,
      quantity: input.quantity,
      expiresAt: input.expiresAt ?? null,
      design: input.design,
      recipientName: input.recipientName,
      recipientPhone: input.recipientPhone,
      message: input.message,
      createdBy: req.adminId,
    });
    await logStaffAction({ adminId: req.adminId, action: 'giftcard.create', module: 'giftcards', details: { count: cards.length, amount: input.amount }, ip: req.ip });
    return res.status(201).json({
      success: true,
      message: `${cards.length} টি গিফট কার্ড তৈরি হয়েছে।`,
      count: cards.length,
      cards: cards.map(serializeGiftCard),
      data: cards.map(serializeGiftCard),
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const ledger = await giftCardLedger(Number(req.params.id));
    return res.json({ success: true, ...ledger, data: ledger });
  })
);

router.patch(
  '/:id/toggle',
  requirePermission('giftcards:write'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [card] = await db.select().from(giftCards).where(eq(giftCards.id, id)).limit(1);
    if (!card) throw new AppError('গিফট কার্ড পাওয়া যায়নি।', 404);
    const nextActive = !card.isActive;
    const [updated] = await db
      .update(giftCards)
      .set({ isActive: nextActive, status: nextActive ? (Number(card.remainingAmount) <= 0 ? 'redeemed' : 'active') : 'inactive', updatedAt: new Date() })
      .where(eq(giftCards.id, id))
      .returning();
    await logStaffAction({ adminId: req.adminId, action: 'giftcard.toggle', module: 'giftcards', targetId: id, details: { isActive: nextActive }, ip: req.ip });
    return res.json({ success: true, message: nextActive ? 'কার্ড সক্রিয় করা হয়েছে।' : 'কার্ড নিষ্ক্রিয় করা হয়েছে।', data: serializeGiftCard(updated) });
  })
);

const adjustSchema = z.object({
  type: z.enum(['credit', 'debit']),
  amount: z.coerce.number().positive('পরিমাণ দিন।'),
  note: z.string().trim().max(500).optional(),
});

router.post(
  '/:id/adjust',
  requirePermission('giftcards:write'),
  validateBody(adjustSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof adjustSchema>;
    const result = await adjustGiftCardBalance({
      identity: Number(req.params.id), type: input.type, amount: input.amount, note: input.note, adminId: req.adminId,
    });
    await logStaffAction({ adminId: req.adminId, action: 'giftcard.adjust', module: 'giftcards', targetId: Number(req.params.id), details: input, ip: req.ip });
    return res.json({ success: true, message: 'ব্যালেন্স আপডেট হয়েছে।', ...result, data: result.card });
  })
);

const updateSchema = z.object({
  expiresAt: z.string().trim().nullable().optional(),
  design: z.enum(['classic', 'festival', 'premium', 'eid']).optional(),
  recipientName: z.string().trim().max(255).optional(),
  recipientPhone: z.string().trim().max(20).optional(),
  message: z.string().trim().max(500).optional(),
});

router.put(
  '/:id',
  requirePermission('giftcards:write'),
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const input = req.body as z.infer<typeof updateSchema>;
    const [card] = await db.select().from(giftCards).where(eq(giftCards.id, id)).limit(1);
    if (!card) throw new AppError('গিফট কার্ড পাওয়া যায়নি।', 404);
    const expiry = input.expiresAt === undefined ? card.expiryDate : input.expiresAt ? new Date(input.expiresAt) : null;
    if (expiry && Number.isNaN(expiry.getTime())) throw new AppError('মেয়াদের তারিখ সঠিক নয়।', 422);
    const [updated] = await db
      .update(giftCards)
      .set({
        expiryDate: expiry,
        design: input.design ?? card.design,
        recipientName: input.recipientName ?? card.recipientName,
        recipientPhone: input.recipientPhone ?? card.recipientPhone,
        message: input.message ?? card.message,
        updatedAt: new Date(),
      })
      .where(eq(giftCards.id, id))
      .returning();
    return res.json({ success: true, message: 'গিফট কার্ড আপডেট হয়েছে।', data: serializeGiftCard(updated) });
  })
);

router.delete(
  '/:id',
  requirePermission('giftcards:write'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    // Cards with a remaining balance are deactivated instead of deleted so the
    // ledger and any redemption history stay auditable.
    const [card] = await db.select().from(giftCards).where(eq(giftCards.id, id)).limit(1);
    if (!card) throw new AppError('গিফট কার্ড পাওয়া যায়নি।', 404);
    if (Number(card.remainingAmount) > 0) {
      await db.update(giftCards).set({ isActive: false, status: 'inactive', updatedAt: new Date() }).where(eq(giftCards.id, id));
      return res.json({ success: true, message: 'কার্ডে ব্যালেন্স আছে, তাই নিষ্ক্রিয় করা হয়েছে (মুছে ফেলা হয়নি)।' });
    }
    await db.delete(giftCards).where(eq(giftCards.id, id));
    await logStaffAction({ adminId: req.adminId, action: 'giftcard.delete', module: 'giftcards', targetId: id, ip: req.ip });
    return res.json({ success: true, message: 'গিফট কার্ড মুছে ফেলা হয়েছে।' });
  })
);

/** Front / back artwork. `format=png` returns a downloadable bitmap. */
router.get(
  '/:id/design',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const side = req.query.side === 'back' ? 'back' : 'front';
    const format = req.query.format === 'png' ? 'png' : req.query.format === 'download' ? 'download' : 'svg';
    const ledger = await giftCardLedger(id);
    const settings = await getSettings();
    const input = {
      code: ledger.card.code,
      amount: ledger.card.remainingAmount,
      initialAmount: ledger.card.initialAmount,
      expiresAt: ledger.card.expiresAt ? ledger.card.expiresAt.slice(0, 10) : null,
      design: ledger.card.design,
      brand: { name: settings.site_name, nameBn: settings.site_name_bn, logo: settings.logo_url, currency: settings.currency_symbol },
      terms: settings.invoice_footer_note,
    };
    const svg = side === 'front' ? renderGiftCardFront(input) : await renderGiftCardBack(input);

    if (format === 'png' || format === 'download') {
      const png = await svgToPng(svg, 1400);
      res.setHeader('Content-Type', 'image/png');
      if (format === 'download') {
        res.setHeader('Content-Disposition', `attachment; filename="giftcard-${ledger.card.code}-${side}.png"`);
      }
      return res.send(png);
    }
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.send(svg);
  })
);

export default router;
