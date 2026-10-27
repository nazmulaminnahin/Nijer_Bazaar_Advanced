import { Router } from 'express';
import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../config/db';
import { crmNotes, orders, users } from '../schemas/index';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticateAdmin, requirePermission } from '../middleware/adminAuth';
import { validateBody } from '../middleware/validate';
import { logStaffAction } from '../services/audit.service';
import { paginate } from '../utils/helpers';

const router = Router();
router.use(authenticateAdmin, requirePermission('customers:read'));

/**
 * Customer CRM table.
 * Column order requested by the business: ক্রমিক নং · কাস্টমারের নাম ·
 * মোবাইল নাম্বার · ইমেইল. Serial numbers continue across pages.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = paginate(req.query as Record<string, unknown>, 20);
    const search = String(req.query.search ?? '').trim();
    const where = search
      ? or(
          ilike(users.name, `%${search}%`),
          ilike(users.phone, `%${search}%`),
          ilike(users.email, `%${search}%`)
        )
      : undefined;

    const [totalRow] = await db.select({ value: count() }).from(users).where(where);
    const rows = await db
      .select()
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    const aggregated = await db
      .select({
        userId: orders.userId,
        orderCount: count(),
        spent: sql<number>`sum(case when ${orders.status} not in ('cancelled','returned') then ${orders.total} else 0 end)`,
        lastOrder: sql<string>`max(${orders.createdAt})`,
      })
      .from(orders)
      .groupBy(orders.userId);

    const data = rows.map((user, index) => {
      const stats = aggregated.find((a) => a.userId === user.id);
      return {
        serial: offset + index + 1, // continues across pagination
        id: user.id,
        name: user.name,
        phone: user.phone ?? '',
        email: user.email ?? '',
        isActive: user.isActive,
        loyaltyPoints: user.loyaltyPoints,
        orderCount: Number(stats?.orderCount ?? 0),
        totalSpent: Number(stats?.spent ?? 0),
        lastOrderAt: stats?.lastOrder ?? null,
        createdAt: user.createdAt.toISOString(),
      };
    });

    const total = Number(totalRow?.value ?? 0);
    return res.json({
      success: true,
      customers: data,
      data,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      columns: ['ক্রমিক নং', 'কাস্টমারের নাম', 'মোবাইল নাম্বার', 'ইমেইল'],
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) throw new AppError('কাস্টমার পাওয়া যায়নি।', 404);
    const userOrders = await db.select().from(orders).where(eq(orders.userId, id)).orderBy(desc(orders.createdAt)).limit(20);
    const notes = await db.select().from(crmNotes).where(eq(crmNotes.userId, id)).orderBy(desc(crmNotes.createdAt));
    const data = {
      id: user.id,
      name: user.name,
      phone: user.phone ?? '',
      email: user.email ?? '',
      isActive: user.isActive,
      loyaltyPoints: user.loyaltyPoints,
      createdAt: user.createdAt.toISOString(),
      orders: userOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        total: Number(o.total),
        status: o.status,
        createdAt: o.createdAt.toISOString(),
      })),
      notes: notes.map((n) => ({ id: n.id, note: n.note, type: n.type, createdAt: n.createdAt.toISOString() })),
    };
    return res.json({ success: true, customer: data, data });
  })
);

const noteSchema = z.object({ note: z.string().trim().min(2, 'নোট লিখুন।').max(2000), type: z.string().trim().max(50).optional() });

router.post(
  '/:id/notes',
  requirePermission('customers:write'),
  validateBody(noteSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
    if (!user) throw new AppError('কাস্টমার পাওয়া যায়নি।', 404);
    const [created] = await db
      .insert(crmNotes)
      .values({ userId: id, adminId: req.adminId, note: req.body.note, type: req.body.type ?? 'general' })
      .returning();
    await logStaffAction({ adminId: req.adminId, action: 'customer.note', module: 'customers', targetId: id, ip: req.ip });
    return res.status(201).json({ success: true, message: 'নোট সংরক্ষণ করা হয়েছে।', data: created });
  })
);

router.patch(
  '/:id/status',
  requirePermission('customers:write'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const isActive = Boolean(req.body?.isActive);
    const [updated] = await db.update(users).set({ isActive, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    if (!updated) throw new AppError('কাস্টমার পাওয়া যায়নি।', 404);
    await logStaffAction({ adminId: req.adminId, action: 'customer.status', module: 'customers', targetId: id, details: { isActive }, ip: req.ip });
    return res.json({ success: true, message: isActive ? 'কাস্টমার সক্রিয় করা হয়েছে।' : 'কাস্টমার নিষ্ক্রিয় করা হয়েছে।' });
  })
);

export default router;
