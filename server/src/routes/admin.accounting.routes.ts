import { Router } from 'express';
import { and, count, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../config/db';
import { expenses, orders, transactions } from '../schemas/index';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticateAdmin, requirePermission } from '../middleware/adminAuth';
import { validateBody } from '../middleware/validate';
import { logStaffAction } from '../services/audit.service';
import { generateInvoiceNumber, money, paginate } from '../utils/helpers';

const router = Router();
router.use(authenticateAdmin, requirePermission('accounting:read'));

function range(query: Record<string, unknown>) {
  const from = query.from ? new Date(String(query.from)) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const to = query.to ? new Date(`${String(query.to)}T23:59:59.999Z`) : new Date();
  return { from, to };
}

/**
 * TRANSACTIONS — money actually received / refunded, optionally tied to orders.
 * Separate data source and page from expenses.
 */
router.get(
  '/transactions',
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = paginate(req.query as Record<string, unknown>, 20);
    const { from, to } = range(req.query as Record<string, unknown>);
    const type = String(req.query.type ?? '');
    const conditions = [gte(transactions.transactionDate, from), lte(transactions.transactionDate, to)];
    if (type && type !== 'all') conditions.push(eq(transactions.type, type));
    const where = and(...conditions);

    const [totalRow] = await db.select({ value: count() }).from(transactions).where(where);
    const rows = await db
      .select({
        id: transactions.id,
        reference: transactions.reference,
        type: transactions.type,
        category: transactions.category,
        amount: transactions.amount,
        paymentMethod: transactions.paymentMethod,
        status: transactions.status,
        description: transactions.description,
        orderId: transactions.orderId,
        orderNumber: orders.orderNumber,
        transactionDate: transactions.transactionDate,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .leftJoin(orders, eq(orders.id, transactions.orderId))
      .where(where)
      .orderBy(desc(transactions.transactionDate))
      .limit(limit)
      .offset(offset);

    const [summary] = await db
      .select({
        income: sql<number>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount} else 0 end), 0)`,
        refunds: sql<number>`coalesce(sum(case when ${transactions.type} = 'refund' then ${transactions.amount} else 0 end), 0)`,
        count: count(),
      })
      .from(transactions)
      .where(where);

    const total = Number(totalRow?.value ?? 0);
    const data = rows.map((r) => ({ ...r, amount: Number(r.amount), transactionDate: r.transactionDate.toISOString() }));
    return res.json({
      success: true,
      transactions: data,
      data,
      total,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      summary: { income: Number(summary?.income ?? 0), refunds: Number(summary?.refunds ?? 0), entries: Number(summary?.count ?? 0) },
    });
  })
);

const transactionSchema = z.object({
  type: z.enum(['income', 'expense', 'refund']),
  amount: z.coerce.number().positive('টাকার পরিমাণ দিন।'),
  category: z.string().trim().max(100).default('general'),
  description: z.string().trim().max(1000).optional(),
  paymentMethod: z.enum(['cash', 'bkash', 'nagad', 'bank', 'card']).default('cash'),
  orderId: z.coerce.number().int().positive().optional().nullable(),
  transactionDate: z.string().trim().optional(),
  reference: z.string().trim().max(60).optional(),
});

router.post(
  '/transactions',
  requirePermission('accounting:write'),
  validateBody(transactionSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof transactionSchema>;
    const reference = input.reference?.trim() || generateInvoiceNumber(Date.now() % 100000);

    // Idempotency: an identical reference + amount + day is rejected.
    const [dup] = await db.select({ id: transactions.id }).from(transactions).where(eq(transactions.reference, reference)).limit(1);
    if (dup) throw new AppError('এই রেফারেন্স নম্বরে ইতিমধ্যে একটি লেনদেন আছে।', 409);

    if (input.orderId) {
      const [order] = await db.select({ id: orders.id }).from(orders).where(eq(orders.id, input.orderId)).limit(1);
      if (!order) throw new AppError('অর্ডার পাওয়া যায়নি।', 404);
    }

    const [created] = await db
      .insert(transactions)
      .values({
        reference,
        type: input.type,
        category: input.category,
        amount: String(money(input.amount)),
        paymentMethod: input.paymentMethod,
        description: input.description ?? null,
        orderId: input.orderId ?? null,
        transactionDate: input.transactionDate ? new Date(input.transactionDate) : new Date(),
        adminId: req.adminId,
      })
      .returning();
    await logStaffAction({ adminId: req.adminId, action: 'transaction.create', module: 'accounting', targetId: created.id, details: { amount: input.amount, type: input.type }, ip: req.ip });
    return res.status(201).json({ success: true, message: 'লেনদেন সংরক্ষণ করা হয়েছে।', data: created });
  })
);

router.delete(
  '/transactions/:id',
  requirePermission('accounting:write'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
    if (!existing) throw new AppError('লেনদেন পাওয়া যায়নি।', 404);
    // Historical financial records are only removable by a super admin, and the
    // deletion is always audited.
    if (req.adminRole !== 'super_admin') {
      throw new AppError('ঐতিহাসিক লেনদেন মুছে ফেলার অনুমতি শুধু সুপার অ্যাডমিনের আছে।', 403);
    }
    await db.delete(transactions).where(eq(transactions.id, id));
    await logStaffAction({ adminId: req.adminId, action: 'transaction.delete', module: 'accounting', targetId: id, details: { amount: Number(existing.amount) }, ip: req.ip });
    return res.json({ success: true, message: 'লেনদেন মুছে ফেলা হয়েছে।' });
  })
);

/** EXPENSES — operating costs with their own fields, page and permissions. */
router.get(
  '/expenses',
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = paginate(req.query as Record<string, unknown>, 20);
    const { from, to } = range(req.query as Record<string, unknown>);
    const category = String(req.query.category ?? '');
    const conditions = [gte(expenses.date, from), lte(expenses.date, to)];
    if (category && category !== 'all') conditions.push(eq(expenses.category, category));
    const where = and(...conditions);

    const [totalRow] = await db.select({ value: count() }).from(expenses).where(where);
    const rows = await db.select().from(expenses).where(where).orderBy(desc(expenses.date)).limit(limit).offset(offset);
    const [summary] = await db
      .select({ total: sql<number>`coalesce(sum(${expenses.amount}), 0)`, count: count() })
      .from(expenses)
      .where(where);
    const byCategory = await db
      .select({ category: expenses.category, total: sql<number>`coalesce(sum(${expenses.amount}), 0)` })
      .from(expenses)
      .where(where)
      .groupBy(expenses.category);

    const total = Number(totalRow?.value ?? 0);
    const data = rows.map((r) => ({ ...r, amount: Number(r.amount), date: r.date.toISOString() }));
    return res.json({
      success: true,
      expenses: data,
      data,
      total,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      summary: {
        totalAmount: Number(summary?.total ?? 0),
        entries: Number(summary?.count ?? 0),
        byCategory: byCategory.map((c) => ({ category: c.category, total: Number(c.total) })),
      },
    });
  })
);

const expenseSchema = z.object({
  title: z.string().trim().min(2, 'খরচের বিবরণ দিন।').max(255),
  category: z.string().trim().max(100).default('other'),
  amount: z.coerce.number().positive('টাকার পরিমাণ দিন।'),
  paymentMethod: z.enum(['cash', 'bkash', 'nagad', 'bank', 'card']).default('cash'),
  description: z.string().trim().max(1000).optional(),
  date: z.string().trim().optional(),
  reference: z.string().trim().max(60).optional(),
  receipt: z.string().trim().max(500).optional(),
});

router.post(
  '/expenses',
  requirePermission('accounting:write'),
  validateBody(expenseSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof expenseSchema>;
    const [created] = await db
      .insert(expenses)
      .values({
        title: input.title,
        category: input.category,
        amount: String(money(input.amount)),
        paymentMethod: input.paymentMethod,
        description: input.description ?? null,
        date: input.date ? new Date(input.date) : new Date(),
        reference: input.reference ?? `EXP-${Date.now().toString().slice(-8)}`,
        receipt: input.receipt ?? null,
        adminId: req.adminId,
      })
      .returning();
    await logStaffAction({ adminId: req.adminId, action: 'expense.create', module: 'accounting', targetId: created.id, details: { amount: input.amount }, ip: req.ip });
    return res.status(201).json({ success: true, message: 'খরচ সংরক্ষণ করা হয়েছে।', data: created });
  })
);

router.delete(
  '/expenses/:id',
  requirePermission('accounting:write'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (req.adminRole !== 'super_admin' && req.adminRole !== 'manager') {
      throw new AppError('খরচ মুছে ফেলার অনুমতি নেই।', 403);
    }
    const [existing] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
    if (!existing) throw new AppError('খরচ পাওয়া যায়নি।', 404);
    await db.delete(expenses).where(eq(expenses.id, id));
    await logStaffAction({ adminId: req.adminId, action: 'expense.delete', module: 'accounting', targetId: id, details: { amount: Number(existing.amount) }, ip: req.ip });
    return res.json({ success: true, message: 'খরচ মুছে ফেলা হয়েছে।' });
  })
);

/** Reconciliation summary — deliberately does NOT call order totals "profit". */
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const { from, to } = range(req.query as Record<string, unknown>);
    const [orderRow] = await db
      .select({
        collectedOrders: count(),
        orderValue: sql<number>`coalesce(sum(case when ${orders.status} = 'delivered' then ${orders.total} else 0 end), 0)`,
        cancelledValue: sql<number>`coalesce(sum(case when ${orders.status} in ('cancelled','returned') then ${orders.total} else 0 end), 0)`,
      })
      .from(orders)
      .where(and(gte(orders.createdAt, from), lte(orders.createdAt, to)));
    const [income] = await db
      .select({ total: sql<number>`coalesce(sum(case when ${transactions.type} in ('income') then ${transactions.amount} else 0 end), 0)` })
      .from(transactions)
      .where(and(gte(transactions.transactionDate, from), lte(transactions.transactionDate, to)));
    const [expenseRow] = await db
      .select({ total: sql<number>`coalesce(sum(${expenses.amount}), 0)` })
      .from(expenses)
      .where(and(gte(expenses.date, from), lte(expenses.date, to)));

    const incomeTotal = Number(income?.total ?? 0);
    const expenseTotal = Number(expenseRow?.total ?? 0);
    return res.json({
      success: true,
      data: {
        range: { from: from.toISOString(), to: to.toISOString() },
        deliveredOrderValue: Number(orderRow?.orderValue ?? 0),
        cancelledOrderValue: Number(orderRow?.cancelledValue ?? 0),
        recordedIncome: incomeTotal,
        recordedExpenses: expenseTotal,
        netRecorded: incomeTotal - expenseTotal,
        note: 'Recorded income/expenses only. Delivered order value is shown separately and is not treated as audited profit.',
      },
    });
  })
);

export default router;
