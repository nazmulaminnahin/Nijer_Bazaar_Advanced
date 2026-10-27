import { Router } from 'express';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../config/db';
import { contactMessages, couriers, inventory, inventoryLog, loyaltyTransactions, products, users } from '../schemas/index';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticateAdmin, requirePermission } from '../middleware/adminAuth';
import { validateBody } from '../middleware/validate';
import { logStaffAction } from '../services/audit.service';
import { paginate } from '../utils/helpers';

const router = Router();
router.use(authenticateAdmin);

// ── Inventory ───────────────────────────────────────────────────────────────
router.get(
  '/inventory',
  requirePermission('inventory:read'),
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = paginate(req.query as Record<string, unknown>, 20);
    const filter = String(req.query.filter ?? '');
    const conditions = filter === 'low' ? sql`${products.stock} <= ${products.lowStockThreshold}` : undefined;
    const [totalRow] = await db.select({ value: count() }).from(products).where(conditions);
    const rows = await db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        stock: products.stock,
        lowStockThreshold: products.lowStockThreshold,
        price: products.price,
        salePrice: products.salePrice,
        isActive: products.isActive,
      })
      .from(products)
      .where(conditions)
      .orderBy(products.stock)
      .limit(limit)
      .offset(offset);
    const total = Number(totalRow?.value ?? 0);
    const data = rows.map((r) => ({ ...r, price: Number(r.salePrice ?? r.price) }));
    return res.json({
      success: true, inventory: data, data, total,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  })
);

router.get(
  '/inventory/logs',
  requirePermission('inventory:read'),
  asyncHandler(async (req, res) => {
    const limit = Math.min(200, Number(req.query.limit ?? 50));
    const rows = await db
      .select({
        id: inventoryLog.id,
        productId: inventoryLog.productId,
        productName: products.name,
        type: inventoryLog.type,
        quantity: inventoryLog.quantity,
        previousStock: inventoryLog.previousStock,
        newStock: inventoryLog.newStock,
        reason: inventoryLog.reason,
        createdAt: inventoryLog.createdAt,
      })
      .from(inventoryLog)
      .leftJoin(products, eq(products.id, inventoryLog.productId))
      .orderBy(desc(inventoryLog.createdAt))
      .limit(limit);
    return res.json({ success: true, logs: rows, data: rows });
  })
);

const adjustSchema = z.object({
  productId: z.coerce.number().int().positive(),
  type: z.enum(['purchase', 'sale', 'return', 'adjustment', 'damaged', 'transfer']).default('adjustment'),
  quantity: z.coerce.number().int().refine((v) => v !== 0, 'পরিমাণ ০ হতে পারে না।'),
  note: z.string().trim().max(500).optional(),
});

router.post(
  '/inventory/adjust',
  requirePermission('inventory:write'),
  validateBody(adjustSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof adjustSchema>;
    const result = await db.transaction(async (tx) => {
      const [product] = await tx.select().from(products).where(eq(products.id, input.productId)).limit(1);
      if (!product) throw new AppError('পণ্যটি পাওয়া যায়নি।', 404);
      const nextStock = product.stock + input.quantity;
      if (nextStock < 0) throw new AppError(`স্টক ০ এর নিচে যেতে পারে না (বর্তমান ${product.stock})।`, 400);
      const [updated] = await tx.update(products).set({ stock: nextStock, updatedAt: new Date() }).where(eq(products.id, product.id)).returning();
      await tx.insert(inventoryLog).values({
        productId: product.id, type: input.type, quantity: input.quantity,
        previousStock: product.stock, newStock: nextStock, reason: input.note ?? 'Manual adjustment', adminId: req.adminId,
      });
      await tx
        .update(inventory)
        .set({ quantity: nextStock, availableQuantity: nextStock, updatedAt: new Date() })
        .where(eq(inventory.productId, product.id));
      return updated;
    });
    await logStaffAction({ adminId: req.adminId, action: 'inventory.adjust', module: 'inventory', targetId: input.productId, details: input, ip: req.ip });
    return res.json({ success: true, message: 'স্টক আপডেট হয়েছে।', data: { id: result.id, stock: result.stock } });
  })
);

// ── Couriers ────────────────────────────────────────────────────────────────
router.get(
  '/couriers',
  requirePermission('couriers:read'),
  asyncHandler(async (_req, res) => {
    const rows = await db.select().from(couriers).orderBy(couriers.name);
    const data = rows.map((c) => ({ ...c, insideDhakaCharge: Number(c.insideDhakaCharge), outsideDhakaCharge: Number(c.outsideDhakaCharge) }));
    return res.json({ success: true, couriers: data, data });
  })
);

const courierSchema = z.object({
  name: z.string().trim().min(2, 'কুরিয়ারের নাম দিন।').max(255),
  logo: z.string().trim().optional().nullable(),
  trackingUrl: z.string().trim().optional().nullable(),
  contactPhone: z.string().trim().max(20).optional().nullable(),
  contactEmail: z.string().trim().max(255).optional().nullable(),
  insideDhakaCharge: z.coerce.number().min(0).default(60),
  outsideDhakaCharge: z.coerce.number().min(0).default(120),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(500).optional().nullable(),
});

router.post(
  '/couriers',
  requirePermission('couriers:write'),
  validateBody(courierSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof courierSchema>;
    const [created] = await db
      .insert(couriers)
      .values({
        name: input.name,
        logo: input.logo ?? null,
        trackingUrl: input.trackingUrl ?? null,
        contactPhone: input.contactPhone ?? null,
        contactEmail: input.contactEmail ?? null,
        insideDhakaCharge: String(input.insideDhakaCharge),
        outsideDhakaCharge: String(input.outsideDhakaCharge),
        isActive: input.isActive ?? true,
        notes: input.notes ?? null,
      })
      .returning();
    return res.status(201).json({ success: true, message: 'কুরিয়ার যোগ করা হয়েছে।', data: created });
  })
);

router.put(
  '/couriers/:id',
  requirePermission('couriers:write'),
  validateBody(courierSchema.partial()),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(couriers).where(eq(couriers.id, id)).limit(1);
    if (!existing) throw new AppError('কুরিয়ার পাওয়া যায়নি।', 404);
    const input = req.body as Partial<z.infer<typeof courierSchema>>;
    const [updated] = await db
      .update(couriers)
      .set({
        name: input.name ?? existing.name,
        logo: input.logo ?? existing.logo,
        trackingUrl: input.trackingUrl ?? existing.trackingUrl,
        contactPhone: input.contactPhone ?? existing.contactPhone,
        contactEmail: input.contactEmail ?? existing.contactEmail,
        insideDhakaCharge: input.insideDhakaCharge != null ? String(input.insideDhakaCharge) : existing.insideDhakaCharge,
        outsideDhakaCharge: input.outsideDhakaCharge != null ? String(input.outsideDhakaCharge) : existing.outsideDhakaCharge,
        isActive: input.isActive ?? existing.isActive,
        notes: input.notes ?? existing.notes,
        updatedAt: new Date(),
      })
      .where(eq(couriers.id, id))
      .returning();
    return res.json({ success: true, message: 'কুরিয়ার আপডেট হয়েছে।', data: updated });
  })
);

router.delete(
  '/couriers/:id',
  requirePermission('couriers:write'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await db.update(couriers).set({ isActive: false, updatedAt: new Date() }).where(eq(couriers.id, id));
    return res.json({ success: true, message: 'কুরিয়ার নিষ্ক্রিয় করা হয়েছে।' });
  })
);

// ── Loyalty ─────────────────────────────────────────────────────────────────
router.get(
  '/loyalty',
  requirePermission('customers:read'),
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = paginate(req.query as Record<string, unknown>, 20);
    const [totalRow] = await db.select({ value: count() }).from(loyaltyTransactions);
    const rows = await db
      .select({
        id: loyaltyTransactions.id,
        userId: loyaltyTransactions.userId,
        userName: users.name,
        type: loyaltyTransactions.type,
        points: loyaltyTransactions.points,
        balance: loyaltyTransactions.balance,
        description: loyaltyTransactions.description,
        createdAt: loyaltyTransactions.createdAt,
      })
      .from(loyaltyTransactions)
      .leftJoin(users, eq(users.id, loyaltyTransactions.userId))
      .orderBy(desc(loyaltyTransactions.createdAt))
      .limit(limit)
      .offset(offset);
    const total = Number(totalRow?.value ?? 0);
    return res.json({
      success: true, transactions: rows, data: rows, total,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  })
);

const grantSchema = z.object({
  userId: z.coerce.number().int().positive(),
  points: z.coerce.number().int().refine((v) => v !== 0, 'পয়েন্ট ০ হতে পারে না।'),
  description: z.string().trim().max(255).optional(),
});

router.post(
  '/loyalty/grant',
  requirePermission('customers:write'),
  validateBody(grantSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof grantSchema>;
    const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
    if (!user) throw new AppError('কাস্টমার পাওয়া যায়নি।', 404);
    const nextBalance = user.loyaltyPoints + input.points;
    if (nextBalance < 0) throw new AppError('পয়েন্ট ব্যালেন্স ০ এর নিচে যেতে পারে না।', 400);
    await db.transaction(async (tx) => {
      await tx.update(users).set({ loyaltyPoints: nextBalance, updatedAt: new Date() }).where(eq(users.id, user.id));
      await tx.insert(loyaltyTransactions).values({
        userId: user.id, type: input.points > 0 ? 'bonus' : 'redeem', points: input.points,
        balance: nextBalance, description: input.description ?? 'Manual adjustment',
      });
    });
    return res.json({ success: true, message: 'লয়্যালটি পয়েন্ট আপডেট হয়েছে।', balance: nextBalance });
  })
);

// ── Contact messages (storefront contact form) ──────────────────────────────
router.get(
  '/contact-messages',
  requirePermission('customers:read'),
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = paginate(req.query as Record<string, unknown>, 20);
    const status = String(req.query.status ?? '').trim();
    const conditions = status && status !== 'all' ? eq(contactMessages.status, status) : undefined;
    const [totalRow] = await db.select({ value: count() }).from(contactMessages).where(conditions);
    const rows = await db
      .select()
      .from(contactMessages)
      .where(conditions)
      .orderBy(desc(contactMessages.createdAt))
      .limit(limit)
      .offset(offset);
    const total = Number(totalRow?.value ?? 0);
    const [newRow] = await db.select({ value: count() }).from(contactMessages).where(eq(contactMessages.status, 'new'));
    return res.json({
      success: true,
      messages: rows,
      data: rows,
      counts: { new: Number(newRow?.value ?? 0), total },
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  })
);

const contactUpdateSchema = z.object({
  status: z.enum(['new', 'read', 'replied', 'closed']).optional(),
  adminNote: z.string().trim().max(2000).optional(),
});

router.patch(
  '/contact-messages/:id',
  requirePermission('customers:write'),
  validateBody(contactUpdateSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new AppError('Invalid message id.', 400);
    const [updated] = await db
      .update(contactMessages)
      .set(req.body as z.infer<typeof contactUpdateSchema>)
      .where(eq(contactMessages.id, id))
      .returning();
    if (!updated) throw new AppError('বার্তাটি পাওয়া যায়নি।', 404);
    return res.json({ success: true, message: 'আপডেট হয়েছে।', data: updated });
  })
);

export default router;
