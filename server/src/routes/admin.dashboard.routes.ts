import { Router } from 'express';
import { and, count, desc, eq, gte, lte, ne, notInArray, sql } from 'drizzle-orm';
import { db } from '../config/db';
import { notifications, orderItems, orders, products, users } from '../schemas/index';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateAdmin, requirePermission } from '../middleware/adminAuth';

console.log('🚀 Admin Dashboard Routes File Loaded Successfully!');

const router = Router();

export const REVENUE_EXCLUDED_STATUSES = ['cancelled', 'returned'];

function rangeFor(period?: string): { from: Date; prevFrom: Date } {
  const days = period === '7d' ? 7 : period === '90d' ? 90 : period === '1y' ? 365 : 30;
  const from = new Date();
  from.setDate(from.getDate() - days);
  const prevFrom = new Date();
  prevFrom.setDate(prevFrom.getDate() - days * 2);
  return { from, prevFrom };
}

function growth(current: number, previous: number): number | null {
  if (!previous) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

router.get(
  '/',
  authenticateAdmin,
  requirePermission('dashboard:read'),
  asyncHandler(async (req, res) => {
    const period = (req.query.period as string) || '30d';
    const { from, prevFrom } = rangeFor(period);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const notExcluded = notInArray(orders.status, REVENUE_EXCLUDED_STATUSES);

    const [today] = await db
      .select({
        orders: count(),
        revenue: sql<number>`coalesce(sum(case when ${notExcluded} then ${orders.total} else 0 end), 0)`,
      })
      .from(orders)
      .where(gte(orders.createdAt, todayStart));

    const [current] = await db
      .select({
        orders: count(),
        revenue: sql<number>`coalesce(sum(case when ${orders.status} not in ('cancelled','returned') then ${orders.total} else 0 end), 0)`,
        avgOrder: sql<number>`coalesce(avg(case when ${orders.status} not in ('cancelled','returned') then ${orders.total} else null end), 0)`,
      })
      .from(orders)
      .where(gte(orders.createdAt, from));

    const [previous] = await db
      .select({
        orders: count(),
        revenue: sql<number>`coalesce(sum(case when ${orders.status} not in ('cancelled','returned') then ${orders.total} else 0 end), 0)`,
      })
      .from(orders)
      .where(and(gte(orders.createdAt, prevFrom), lte(orders.createdAt, from)));

    const [allTime] = await db
      .select({
        orders: count(),
        revenue: sql<number>`coalesce(sum(case when ${orders.status} not in ('cancelled','returned') then ${orders.total} else 0 end), 0)`,
      })
      .from(orders);

    const [pendingRow] = await db.select({ value: count() }).from(orders).where(eq(orders.status, 'pending'));
    const [shippedRow] = await db.select({ value: count() }).from(orders).where(eq(orders.status, 'shipped'));
    const [customerRow] = await db.select({ value: count() }).from(users).where(eq(users.role, 'customer'));
    const [productRow] = await db.select({ value: count() }).from(products).where(eq(products.isActive, true));
    const [newCustomerRow] = await db
      .select({ value: count() })
      .from(users)
      .where(and(eq(users.role, 'customer'), gte(users.createdAt, from)));
    const [lowStockRow] = await db
      .select({ value: count() })
      .from(products)
      .where(and(eq(products.isActive, true), sql`${products.stock} <= ${products.lowStockThreshold}`));

    const statusBreakdown = await db
      .select({ status: orders.status, value: count() })
      .from(orders)
      .groupBy(orders.status);

    const stats = {
      todayRevenue: Number(today?.revenue ?? 0),
      todayOrders: Number(today?.orders ?? 0),
      totalRevenue: Number(allTime?.revenue ?? 0),
      totalOrders: Number(allTime?.orders ?? 0),
      periodRevenue: Number(current?.revenue ?? 0),
      periodOrders: Number(current?.orders ?? 0),
      averageOrderValue: Math.round(Number(current?.avgOrder ?? 0)),
      revenueGrowth: growth(Number(current?.revenue ?? 0), Number(previous?.revenue ?? 0)),
      ordersGrowth: growth(Number(current?.orders ?? 0), Number(previous?.orders ?? 0)),
      pendingOrders: Number(pendingRow?.value ?? 0),
      shippedOrders: Number(shippedRow?.value ?? 0),
      totalCustomers: Number(customerRow?.value ?? 0),
      newCustomers: Number(newCustomerRow?.value ?? 0),
      totalProducts: Number(productRow?.value ?? 0),
      lowStockProducts: Number(lowStockRow?.value ?? 0),
      statusBreakdown: Object.fromEntries(statusBreakdown.map((s) => [s.status, Number(s.value)])),
      period,
      revenueRule: 'Cancelled and returned orders are excluded from revenue.',
    };

    return res.json({ success: true, stats, data: { stats } });
  })
);

router.get(
  '/top-products',
  authenticateAdmin,
  requirePermission('dashboard:read'),
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        productId: orderItems.productId,
        name: orderItems.productName,
        image: sql<string | null>`max(${orderItems.productImage})`,
        soldCount: sql<number>`sum(${orderItems.quantity})`,
        revenue: sql<number>`sum(${orderItems.quantity} * ${orderItems.price})`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(ne(orders.status, 'cancelled'))
      .groupBy(orderItems.productId, orderItems.productName)
      .orderBy(desc(sql`sum(${orderItems.quantity})`))
      .limit(8);
    const data = rows.map((r) => ({
      id: r.productId,
      name: r.name,
      image: r.image,
      soldCount: Number(r.soldCount),
      revenue: Number(r.revenue),
    }));
    return res.json({ success: true, products: data, data });
  })
);

router.get(
  '/low-stock',
  authenticateAdmin,
  requirePermission('dashboard:read'),
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({ id: products.id, name: products.name, sku: products.sku, stock: products.stock, lowStockThreshold: products.lowStockThreshold })
      .from(products)
      .where(and(eq(products.isActive, true), sql`${products.stock} <= ${products.lowStockThreshold}`))
      .orderBy(products.stock)
      .limit(10);
    return res.json({ success: true, products: rows, data: rows });
  })
);

router.get(
  '/recent-orders',
  authenticateAdmin,
  requirePermission('dashboard:read'),
  asyncHandler(async (_req, res) => {
    const rows = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(8);
    const data = rows.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.shippingAddress?.name ?? '',
      total: Number(o.total),
      status: o.status,
      createdAt: o.createdAt.toISOString(),
    }));
    return res.json({ success: true, orders: data, data });
  })
);

router.get(
  '/notifications',
  authenticateAdmin,
  asyncHandler(async (_req, res) => {
    const [pending] = await db.select({ value: count() }).from(orders).where(eq(orders.status, 'pending'));
    const [low] = await db
      .select({ value: count() })
      .from(products)
      .where(and(eq(products.isActive, true), sql`${products.stock} <= ${products.lowStockThreshold}`));
    const recent = await db
      .select()
      .from(notifications)
      .where(eq(notifications.isRead, false))
      .orderBy(desc(notifications.createdAt))
      .limit(10);

    const items = [
      {
        id: 'pending-orders',
        type: 'order',
        title: `${Number(pending?.value ?? 0)} টি অর্ডার পেন্ডিং`,
        message: 'নতুন অর্ডারগুলো কনফার্ম করুন।',
        href: '/admin/orders?status=pending',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'low-stock',
        type: 'inventory',
        title: `${Number(low?.value ?? 0)} টি পণ্যের স্টক কম`,
        message: 'স্টক রিফিল করুন।',
        href: '/admin/inventory?filter=low',
        createdAt: new Date().toISOString(),
      },
      ...recent.map((n) => ({
        id: `n-${n.id}`,
        type: n.type,
        title: n.title,
        message: n.message,
        href: '/api/admin/dashboard/notifications',
        createdAt: n.createdAt.toISOString(),
      })),
    ];
    return res.json({ success: true, notifications: items, data: items, unread: items.length });
  })
);

export default router;