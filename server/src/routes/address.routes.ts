import { Router } from 'express';
import { and, desc, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../config/db';
import { addresses } from '../schemas/index';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { isValidBdPhone, normalizePhone } from '../utils/helpers';

const router = Router();
router.use(authenticate);

const addressSchema = z.object({
  label: z.string().trim().max(60).optional().nullable(),
  name: z.string().trim().min(2, 'নাম দিন।').max(255),
  phone: z.string().trim().min(11, 'সঠিক মোবাইল নম্বর দিন।'),
  address: z.string().trim().min(6, 'সম্পূর্ণ ঠিকানা লিখুন।').max(500),
  division: z.string().trim().min(2, 'বিভাগ নির্বাচন করুন।'),
  district: z.string().trim().min(2, 'জেলা নির্বাচন করুন।'),
  thana: z.string().trim().min(2, 'থানা লিখুন।'),
  city: z.string().trim().max(100).optional().nullable(),
  postalCode: z.string().trim().max(20).optional().nullable(),
  isDefault: z.boolean().optional(),
});

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const rows = await db
      .select()
      .from(addresses)
      .where(eq(addresses.userId, req.userId!))
      .orderBy(desc(addresses.isDefault), desc(addresses.updatedAt));
    return res.json({ success: true, addresses: rows, data: rows });
  })
);

router.post(
  '/',
  validateBody(addressSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const input = req.body as z.infer<typeof addressSchema>;
    const phone = normalizePhone(input.phone);
    if (!isValidBdPhone(phone)) throw new AppError('মোবাইল নম্বরটি সঠিক নয় (যেমন: 01712345678)।', 422);

    const created = await db.transaction(async (tx) => {
      const existing = await tx.select({ id: addresses.id }).from(addresses).where(eq(addresses.userId, req.userId!));
      const makeDefault = input.isDefault === true || existing.length === 0;
      if (makeDefault) {
        await tx.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, req.userId!));
      }
      const [row] = await tx
        .insert(addresses)
        .values({
          userId: req.userId!,
          label: input.label ?? null,
          name: input.name,
          phone,
          address: input.address,
          division: input.division,
          district: input.district,
          thana: input.thana,
          city: input.city ?? null,
          postalCode: input.postalCode ?? null,
          isDefault: makeDefault,
        })
        .returning();
      return row;
    });
    return res.status(201).json({ success: true, message: 'ঠিকানা সংরক্ষণ করা হয়েছে।', address: created, data: created });
  })
);

router.put(
  '/:id',
  validateBody(addressSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    const [existing] = await db
      .select()
      .from(addresses)
      .where(and(eq(addresses.id, id), eq(addresses.userId, req.userId!)))
      .limit(1);
    if (!existing) throw new AppError('ঠিকানাটি পাওয়া যায়নি।', 404);

    const input = req.body as z.infer<typeof addressSchema>;
    const phone = normalizePhone(input.phone);
    if (!isValidBdPhone(phone)) throw new AppError('মোবাইল নম্বরটি সঠিক নয়।', 422);

    const updated = await db.transaction(async (tx) => {
      if (input.isDefault) {
        await tx.update(addresses).set({ isDefault: false }).where(and(eq(addresses.userId, req.userId!), ne(addresses.id, id)));
      }
      const [row] = await tx
        .update(addresses)
        .set({
          label: input.label ?? null,
          name: input.name,
          phone,
          address: input.address,
          division: input.division,
          district: input.district,
          thana: input.thana,
          city: input.city ?? null,
          postalCode: input.postalCode ?? null,
          isDefault: input.isDefault ?? existing.isDefault,
          updatedAt: new Date(),
        })
        .where(eq(addresses.id, id))
        .returning();
      return row;
    });
    return res.json({ success: true, message: 'ঠিকানা আপডেট হয়েছে।', address: updated, data: updated });
  })
);

router.patch(
  '/:id/default',
  asyncHandler(async (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    const [existing] = await db
      .select()
      .from(addresses)
      .where(and(eq(addresses.id, id), eq(addresses.userId, req.userId!)))
      .limit(1);
    if (!existing) throw new AppError('ঠিকানাটি পাওয়া যায়নি।', 404);
    await db.transaction(async (tx) => {
      await tx.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, req.userId!));
      await tx.update(addresses).set({ isDefault: true, updatedAt: new Date() }).where(eq(addresses.id, id));
    });
    return res.json({ success: true, message: 'ডিফল্ট ঠিকানা নির্ধারণ করা হয়েছে।' });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    const [existing] = await db
      .select()
      .from(addresses)
      .where(and(eq(addresses.id, id), eq(addresses.userId, req.userId!)))
      .limit(1);
    if (!existing) throw new AppError('ঠিকানাটি পাওয়া যায়নি।', 404);
    await db.delete(addresses).where(eq(addresses.id, id));
    if (existing.isDefault) {
      const [next] = await db.select().from(addresses).where(eq(addresses.userId, req.userId!)).limit(1);
      if (next) await db.update(addresses).set({ isDefault: true }).where(eq(addresses.id, next.id));
    }
    return res.json({ success: true, message: 'ঠিকানা মুছে ফেলা হয়েছে।' });
  })
);

export default router;
