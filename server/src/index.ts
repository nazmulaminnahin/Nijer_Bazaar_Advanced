import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { env } from './config/env';
import { testConnection } from './config/db';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { rateLimit } from './middleware/rateLimit';

import authRoutes from './routes/auth.routes';
import publicRoutes from './routes/public.routes';
import productRoutes from './routes/product.routes';
import categoryRoutes from './routes/category.routes';
import cartRoutes from './routes/cart.routes';
import wishlistRoutes from './routes/wishlist.routes';
import addressRoutes from './routes/address.routes';
import orderRoutes from './routes/order.routes';
import couponPublicRoutes from './routes/coupon.public.routes';
import adminCouponRoutes from './routes/admin.coupons.routes';
import flashsalePublicRoutes from './routes/flashsale.public.routes';
import adminFlashsaleRoutes from './routes/admin.flashsales.routes';
import adminGiftcardRoutes from './routes/admin.giftcards.routes';
import adminReportRoutes from './routes/admin.reports.routes';
import adminCustomerRoutes from './routes/admin.customers.routes';
import adminSettingsRoutes from './routes/admin.settings.routes';
import adminStaffRoutes from './routes/admin.staff.routes';
import adminAccountingRoutes from './routes/admin.accounting.routes';
import adminMiscRoutes from './routes/admin.misc.routes';
import adminNotificationRoutes from './routes/admin.notifications.routes';
import adminTestimonialRoutes from './routes/admin.testimonials.routes';
import customerNotificationRoutes from './routes/customer.notification.routes';
import uploadRoutes from './routes/upload.routes';

// ড্যাশবোর্ডের রাউটগুলোর জন্য এবং 'and' সহ প্রয়োজনীয় মডিউল ইমপোর্ট
import { and, count, desc, eq, gte, lte, ne, notInArray, sql } from 'drizzle-orm';
import { db } from './config/db';
import { orderItems, orders, products, users } from './schemas/index';
import { asyncHandler } from './middleware/errorHandler';
import { authenticateAdmin, requirePermission } from './middleware/adminAuth';

function dashboardGrowth(current: number, previous: number): number {
  if (!previous) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  const allowedOrigins = new Set([
    env.CLIENT_URL,
    'http://localhost:5173',
    'http://localhost:4173',
    'http://127.0.0.1:5173',
    ...env.CORS_ORIGINS,
  ]);
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.has(origin)) return callback(null, true);
        if (/^https:\/\/[a-z0-9-]+\.e2b\.app$/i.test(origin)) return callback(null, true);
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return callback(null, true);
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(rateLimit({ windowMs: 60_000, max: 600, keyPrefix: 'global:' }));

  // Uploaded media
  const uploadRoot = path.isAbsolute(env.UPLOAD_DIR) ? env.UPLOAD_DIR : path.join(process.cwd(), env.UPLOAD_DIR);
  fs.mkdirSync(uploadRoot, { recursive: true });
  app.use(env.UPLOAD_PUBLIC_PREFIX, express.static(uploadRoot, { maxAge: '7d', fallthrough: true }));

  // When the built storefront (client/dist) exists, "/" must serve the website,
  // so the JSON status is only exposed on "/" when there is no frontend build.
  const clientDistDir = path.join(__dirname, '../../client/dist');
  const hasClientBuild = fs.existsSync(path.join(clientDistDir, 'index.html'));
  app.get(hasClientBuild ? ['/api', '/api/health'] : ['/', '/api', '/api/health'], (_req, res) => {
    res.json({
      success: true,
      message: '🛒 Nijer Bazaar API is running',
      version: '2.0.0',
      environment: env.NODE_ENV,
      database: env.DB_DRIVER,
      timestamp: new Date().toISOString(),
    });
  });

  // ── Public / storefront ───────────────────────────────────────────────────
  app.use('/api', publicRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api/wishlist', wishlistRoutes);
  app.use('/api/addresses', addressRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/coupons', adminCouponRoutes);
  app.use('/api/coupons', couponPublicRoutes);
  app.use('/api/flash-sales', flashsalePublicRoutes);
  app.use('/api/flash-sales', adminFlashsaleRoutes);
  app.use('/api/gift-cards', adminGiftcardRoutes);
  app.use('/api/notifications', customerNotificationRoutes);
  app.use('/api/uploads', uploadRoutes);

  // ── Admin Dashboard Embedded Routes ────────────────────────────────────────
  app.get(
    '/api/admin/dashboard',
    authenticateAdmin,
    requirePermission('dashboard:read'),
    asyncHandler(async (req, res) => {
      const period = (req.query.period as string) || '30d';
      const days = period === '7d' ? 7 : period === '90d' ? 90 : period === '1y' ? 365 : 30;
      const from = new Date();
      from.setDate(from.getDate() - days);
      const prevFrom = new Date();
      prevFrom.setDate(prevFrom.getDate() - days * 2);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [today] = await db
        .select({
          orders: count(),
          revenue: sql<number>`coalesce(sum(case when ${notInArray(orders.status, ['cancelled', 'returned'])} then ${orders.total} else 0 end), 0)`,
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
      const statusRows = await db
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
        revenueGrowth: dashboardGrowth(Number(current?.revenue ?? 0), Number(previous?.revenue ?? 0)),
        ordersGrowth: dashboardGrowth(Number(current?.orders ?? 0), Number(previous?.orders ?? 0)),
        pendingOrders: Number(pendingRow?.value ?? 0),
        shippedOrders: Number(shippedRow?.value ?? 0),
        totalCustomers: Number(customerRow?.value ?? 0),
        newCustomers: Number(newCustomerRow?.value ?? 0),
        totalProducts: Number(productRow?.value ?? 0),
        lowStockProducts: Number(lowStockRow?.value ?? 0),
        statusBreakdown: Object.fromEntries(statusRows.map((s) => [s.status, Number(s.value)])),
        period,
        revenueRule: 'Cancelled and returned orders are excluded from revenue.',
      };

      return res.json({ success: true, stats, data: { stats } });
    })
  );

  app.get(
    '/api/admin/dashboard/recent-orders',
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

  app.get(
    '/api/admin/dashboard/top-products',
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

  app.get(
    '/api/admin/dashboard/low-stock',
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

  app.get(
    '/api/admin/dashboard/notifications',
    authenticateAdmin,
    asyncHandler(async (_req, res) => {
      const [pending] = await db.select({ value: count() }).from(orders).where(eq(orders.status, 'pending'));
      const [low] = await db
        .select({ value: count() })
        .from(products)
        .where(and(eq(products.isActive, true), sql`${products.stock} <= ${products.lowStockThreshold}`));

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
      ];
      return res.json({ success: true, notifications: items, data: items, unread: items.length });
    })
  );

  // ── Admin ─────────────────────────────────────────────────────────────────
  app.use('/api/admin/reports', adminReportRoutes);
  app.use('/api/admin/customers', adminCustomerRoutes);
  app.use('/api/admin/settings', adminSettingsRoutes);
  app.use('/api/admin/staff', adminStaffRoutes);
  app.use('/api/admin/notifications', adminNotificationRoutes);
  app.use('/api/admin/testimonials', adminTestimonialRoutes);
  app.use('/api/admin', adminMiscRoutes); // inventory, couriers, loyalty
  app.use('/api/accounting', adminAccountingRoutes);

  // ── Optional single-port deployment: serve the built SPA ─────────────────
  const clientDist = path.join(__dirname, '../../client/dist');
  if (fs.existsSync(path.join(clientDist, 'index.html'))) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api|\/uploads).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

async function start() {
  await testConnection();
  const app = createApp();
  const port = parseInt(env.PORT, 10);
  app.listen(port, '0.0.0.0', () => {
    console.log('');
    console.log('🛒 ================================');
    console.log('   NIJER BAZAAR API STARTED');
    console.log('🛒 ================================');
    console.log(`🌍 Server:   http://localhost:${port}`);
    console.log(`🌍 API:      http://localhost:${port}/api`);
    console.log(`📦 Mode:     ${env.NODE_ENV}`);
    console.log(`🗄️  DB:      ${env.DB_DRIVER}`);
    console.log('🛒 ================================');
    console.log('');
  });
}

if (require.main === module) {
  start().catch((err) => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  });
}

export default createApp;