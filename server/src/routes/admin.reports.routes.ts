import { Router } from 'express';
import { and, count, desc, eq, gte, lte, notInArray, sql } from 'drizzle-orm';
import { db } from '../config/db';
import { categories, orderItems, orders, products, users } from '../schemas/index';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateAdmin, requirePermission } from '../middleware/adminAuth';

const router = Router();
router.use(authenticateAdmin, requirePermission('reports:read'));

const EXCLUDED = ['cancelled', 'returned'];

function resolveRange(query: Record<string, unknown>) {
  const period = String(query.period ?? '30d');
  const days = period === '7d' ? 7 : period === '90d' ? 90 : period === '1y' ? 365 : 30;
  const from = query.from ? new Date(String(query.from)) : new Date(Date.now() - days * 86_400_000);
  const to = query.to ? new Date(`${String(query.to)}T23:59:59.999Z`) : new Date();
  return { from, to, period, days };
}

/** Report 1 — Sales over time + KPIs. */
router.get(
  '/sales',
  asyncHandler(async (req, res) => {
    const { from, to, period } = resolveRange(req.query as Record<string, unknown>);
    const rows = await db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${orders.createdAt}), 'YYYY-MM-DD')`,
        revenue: sql<number>`coalesce(sum(case when ${orders.status} not in ('cancelled','returned') then ${orders.total} else 0 end), 0)`,
        orders: count(),
        delivered: sql<number>`coalesce(sum(case when ${orders.status} = 'delivered' then 1 else 0 end), 0)`,
        cancelled: sql<number>`coalesce(sum(case when ${orders.status} in ('cancelled','returned') then 1 else 0 end), 0)`,
      })
      .from(orders)
      .where(and(gte(orders.createdAt, from), lte(orders.createdAt, to)))
      .groupBy(sql`1`)
      .orderBy(sql`1`);

    const summaryRow = rows.reduce(
      (acc, r) => ({
        revenue: acc.revenue + Number(r.revenue),
        orders: acc.orders + Number(r.orders),
        delivered: acc.delivered + Number(r.delivered),
        cancelled: acc.cancelled + Number(r.cancelled),
      }),
      { revenue: 0, orders: 0, delivered: 0, cancelled: 0 }
    );

    const data = rows.map((r) => ({
      date: r.date,
      revenue: Number(r.revenue),
      orders: Number(r.orders),
      delivered: Number(r.delivered),
      cancelled: Number(r.cancelled),
      avgOrderValue: Number(r.orders) ? Math.round(Number(r.revenue) / Number(r.orders)) : 0,
    }));

    return res.json({
      success: true,
      data,
      salesData: data,
      summary: { ...summaryRow, avgOrderValue: summaryRow.orders ? Math.round(summaryRow.revenue / summaryRow.orders) : 0, period },
      range: { from: from.toISOString(), to: to.toISOString() },
    });
  })
);

/** Report 2 — Product performance, computed from real order lines. */
router.get(
  '/products',
  asyncHandler(async (req, res) => {
    const { from, to } = resolveRange(req.query as Record<string, unknown>);
    const rows = await db
      .select({
        productId: orderItems.productId,
        name: orderItems.productName,
        sku: orderItems.productSku,
        quantity: sql<number>`sum(${orderItems.quantity})`,
        revenue: sql<number>`sum(${orderItems.quantity} * ${orderItems.price})`,
        orders: sql<number>`count(distinct ${orderItems.orderId})`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(notInArray(orders.status, EXCLUDED), gte(orders.createdAt, from), lte(orders.createdAt, to)))
      .groupBy(orderItems.productId, orderItems.productName, orderItems.productSku)
      .orderBy(desc(sql`sum(${orderItems.quantity} * ${orderItems.price})`))
      .limit(50);

    const stockRows = await db.select({ id: products.id, stock: products.stock, price: products.price, salePrice: products.salePrice }).from(products);
    const data = rows.map((r) => {
      const stock = stockRows.find((s) => s.id === r.productId);
      return {
        productId: r.productId,
        name: r.name,
        sku: r.sku,
        soldCount: Number(r.quantity),
        revenue: Number(r.revenue),
        orders: Number(r.orders),
        stock: stock?.stock ?? 0,
        unitPrice: Number(stock?.salePrice ?? stock?.price ?? 0),
      };
    });
    return res.json({
      success: true,
      data,
      productsData: data,
      summary: {
        products: data.length,
        unitsSold: data.reduce((s, r) => s + r.soldCount, 0),
        revenue: data.reduce((s, r) => s + r.revenue, 0),
      },
    });
  })
);

/** Report 3 — Customer acquisition + top customers. */
router.get(
  '/customers',
  asyncHandler(async (req, res) => {
    const { from, to } = resolveRange(req.query as Record<string, unknown>);
    const signups = await db
      .select({ date: sql<string>`to_char(date_trunc('day', ${users.createdAt}), 'YYYY-MM-DD')`, newCustomers: count() })
      .from(users)
      .where(and(eq(users.role, 'customer'), gte(users.createdAt, from), lte(users.createdAt, to)))
      .groupBy(sql`1`)
      .orderBy(sql`1`);

    const top = await db
      .select({
        userId: orders.userId,
        name: sql<string>`${orders.shippingAddress}->>'name'`,
        phone: sql<string>`${orders.shippingAddress}->>'phone'`,
        orders: count(),
        spent: sql<number>`sum(case when ${orders.status} not in ('cancelled','returned') then ${orders.total} else 0 end)`,
      })
      .from(orders)
      .where(and(gte(orders.createdAt, from), lte(orders.createdAt, to)))
      .groupBy(orders.userId, sql`${orders.shippingAddress}->>'name'`, sql`${orders.shippingAddress}->>'phone'`)
      .orderBy(desc(sql`sum(case when ${orders.status} not in ('cancelled','returned') then ${orders.total} else 0 end)`))
      .limit(20);

    const [totals] = await db.select({ value: count() }).from(users).where(eq(users.role, 'customer'));
    const repeat = await db
      .select({ userId: orders.userId, value: count() })
      .from(orders)
      .groupBy(orders.userId);

    const data = signups.map((s) => ({ date: s.date, newCustomers: Number(s.newCustomers), returningCustomers: 0 }));
    return res.json({
      success: true,
      data,
      newCustomers: data,
      topCustomers: top.map((t) => ({
        userId: t.userId,
        name: t.name,
        phone: t.phone,
        orders: Number(t.orders),
        spent: Number(t.spent),
      })),
      summary: {
        totalCustomers: Number(totals?.value ?? 0),
        newInPeriod: data.reduce((s, d) => s + d.newCustomers, 0),
        repeatCustomers: repeat.filter((r) => Number(r.value) > 1).length,
      },
    });
  })
);

/** Category mix, used by the sales report chart. */
router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const { from, to } = resolveRange(req.query as Record<string, unknown>);
    const rows = await db
      .select({
        category: sql<string>`coalesce(${categories.name}, 'অন্যান্য')`,
        revenue: sql<number>`coalesce(sum(${orderItems.quantity} * ${orderItems.price}), 0)`,
        units: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .leftJoin(products, eq(products.id, orderItems.productId))
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .where(and(notInArray(orders.status, EXCLUDED), gte(orders.createdAt, from), lte(orders.createdAt, to)))
      .groupBy(sql`coalesce(${categories.name}, 'অন্যান্য')`)
      .orderBy(desc(sql`coalesce(sum(${orderItems.quantity} * ${orderItems.price}), 0)`));
    const data = rows.map((r) => ({ category: r.category, revenue: Number(r.revenue), units: Number(r.units) }));
    return res.json({ success: true, data });
  })
);

export default router;
