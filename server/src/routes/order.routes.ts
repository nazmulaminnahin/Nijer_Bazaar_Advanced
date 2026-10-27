import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../config/db';
import { couriers, orders } from '../schemas/index';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authenticateAdmin, requirePermission } from '../middleware/adminAuth';
import { validateBody } from '../middleware/validate';
import {
  ORDER_STATUSES, ORDER_STATUS_LABELS_BN, editOrderItems, getOrderWithDetail, listOrdersForAdmin,
  orderStats, placeOrder, serializeOrder, updateOrderStatus,
} from '../services/order.service';
import { getInvoiceData, renderInvoiceHtml } from '../services/invoice.service';
import { logStaffAction } from '../services/audit.service';
import { paginate } from '../utils/helpers';

const router = Router();

const placeOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.coerce.number().int().positive(),
    quantity: z.coerce.number().int().min(1).max(999),
    variant: z.string().trim().max(255).optional(),
  })).min(1, 'আপনার কার্ট খালি।'),
  shippingAddress: z.object({
    name: z.string().trim().min(2, 'নাম দিন।'),
    phone: z.string().trim().min(11, 'সঠিক মোবাইল নম্বর দিন।'),
    address: z.string().trim().min(6, 'সম্পূর্ণ ঠিকানা লিখুন।'),
    division: z.string().trim().min(2, 'বিভাগ নির্বাচন করুন।'),
    district: z.string().trim().min(2, 'জেলা নির্বাচন করুন।'),
    thana: z.string().trim().min(2, 'থানা লিখুন।'),
    city: z.string().trim().optional(),
    postalCode: z.string().trim().optional(),
    email: z.string().trim().optional(),
    note: z.string().trim().max(500).optional(),
  }),
  paymentMethod: z.enum(['cod', 'bkash', 'nagad', 'card']).default('cod'),
  couponCode: z.string().trim().optional(),
  notes: z.string().trim().max(1000).optional(),
  clearCart: z.boolean().optional(),
});

// ── Customer: place order ───────────────────────────────────────────────────
router.post(
  '/',
  authenticate,
  validateBody(placeOrderSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await placeOrder(req.body as never, req.userId!);
    const detail = await getOrderWithDetail(result.order.id);
    return res.status(201).json({
      success: true,
      message: 'অর্ডার সফলভাবে গ্রহণ করা হয়েছে।',
      order: detail,
      data: detail,
      invoiceNumber: result.order.invoiceNumber,
      orderNumber: result.order.orderNumber,
      totals: result.totals,
      shipping: result.quote,
    });
  })
);

router.get(
  '/my',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { page, limit } = paginate(req.query as Record<string, unknown>, 10);
    const rows = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, req.userId!))
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);
    const data = [];
    for (const row of rows) {
      const detail = await getOrderWithDetail(row.id);
      if (detail) data.push(detail);
    }
    return res.json({ success: true, orders: data, data, page, limit });
  })
);

router.get(
  '/track',
  asyncHandler(async (req, res) => {
    const orderNumber = String(req.query.orderNumber ?? req.query.order ?? '').trim();
    const phone = String(req.query.phone ?? '').trim();
    if (!orderNumber) throw new AppError('অর্ডার নম্বর দিন।', 422);
    const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
    if (!order) throw new AppError('এই অর্ডার নম্বরটি পাওয়া যায়নি।', 404);
    // Phone acts as a weak secret so order details are not public.
    if (phone) {
      const digits = phone.replace(/\D/g, '').slice(-11);
      if (!(order.shippingAddress?.phone ?? '').includes(digits)) {
        throw new AppError('এই অর্ডার নম্বর ও মোবাইল নম্বর মিলছে না।', 404);
      }
    }
    const detail = await getOrderWithDetail(order.id);
    return res.json({ success: true, order: detail, data: detail });
  })
);

// ── Admin: listing, stats, detail ───────────────────────────────────────────
router.get(
  '/admin/stats',
  authenticateAdmin,
  requirePermission('orders:read'),
  asyncHandler(async (_req, res) => {
    const stats = await orderStats();
    return res.json({ success: true, stats, data: stats });
  })
);

router.get(
  '/admin/all',
  authenticateAdmin,
  requirePermission('orders:read'),
  asyncHandler(async (req, res) => {
    const { page, limit } = paginate(req.query as Record<string, unknown>, 15);
    const result = await listOrdersForAdmin({
      status: (req.query.status as string) || 'all',
      paymentStatus: (req.query.paymentStatus as string) || undefined,
      search: (req.query.search as string) || undefined,
      from: (req.query.from as string) || undefined,
      to: (req.query.to as string) || undefined,
      page,
      limit,
    });
    return res.json({
      success: true,
      orders: result.data,
      data: result.data,
      pagination: result.pagination,
      counts: result.counts,
      ...result.pagination,
    });
  })
);

// Convenience alias so `/api/orders` also works for admin clients.
router.get(
  '/',
  authenticateAdmin,
  requirePermission('orders:read'),
  asyncHandler(async (req, res) => {
    const { page, limit } = paginate(req.query as Record<string, unknown>, 15);
    const result = await listOrdersForAdmin({
      status: (req.query.status as string) || 'all',
      paymentStatus: (req.query.paymentStatus as string) || undefined,
      search: (req.query.search as string) || undefined,
      from: (req.query.from as string) || undefined,
      to: (req.query.to as string) || undefined,
      page,
      limit,
    });
    return res.json({ success: true, orders: result.data, data: result.data, pagination: result.pagination, counts: result.counts, ...result.pagination });
  })
);

router.get(
  '/admin/:id',
  authenticateAdmin,
  requirePermission('orders:read'),
  asyncHandler(async (req, res) => {
    const detail = await getOrderWithDetail(Number(req.params.id));
    if (!detail) throw new AppError('অর্ডারটি পাওয়া যায়নি।', 404);
    return res.json({ success: true, order: detail, data: detail });
  })
);

// ── Admin: status, courier, items ───────────────────────────────────────────
const statusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(500).optional(),
  force: z.boolean().optional(),
});

router.put(
  '/admin/:id/status',
  authenticateAdmin,
  requirePermission('orders:write'),
  validateBody(statusSchema),
  asyncHandler(async (req, res) => {
    const { status, note, force } = req.body as z.infer<typeof statusSchema>;
    const order = await updateOrderStatus(Number(req.params.id), status, { adminId: req.adminId!, note, force });
    await logStaffAction({ adminId: req.adminId, action: 'order.status', module: 'orders', targetId: Number(req.params.id), details: { status }, ip: req.ip });
    return res.json({ success: true, message: `স্ট্যাটাস "${ORDER_STATUS_LABELS_BN[status] ?? status}" এ পরিবর্তন করা হয়েছে।`, order, data: order });
  })
);

const courierSchema = z.object({
  courierId: z.coerce.number().int().positive().nullable().optional(),
  courierTrackingId: z.string().trim().max(255).optional(),
  trackingNumber: z.string().trim().max(255).optional(),
});

router.patch(
  '/admin/:id/courier',
  authenticateAdmin,
  requirePermission('orders:write'),
  validateBody(courierSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { courierId, courierTrackingId, trackingNumber } = req.body as z.infer<typeof courierSchema>;
    if (courierId) {
      const [courier] = await db.select().from(couriers).where(eq(couriers.id, courierId)).limit(1);
      if (!courier) throw new AppError('কুরিয়ার পাওয়া যায়নি।', 404);
    }
    const [updated] = await db
      .update(orders)
      .set({ courierId: courierId ?? null, trackingNumber: courierTrackingId ?? trackingNumber ?? null, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    if (!updated) throw new AppError('অর্ডারটি পাওয়া যায়নি।', 404);
    await logStaffAction({ adminId: req.adminId, action: 'order.courier', module: 'orders', targetId: id, details: { courierId }, ip: req.ip });
    return res.json({ success: true, message: 'কুরিয়ার তথ্য সংরক্ষণ করা হয়েছে।', order: serializeOrder(updated), data: serializeOrder(updated) });
  })
);

const editSchema = z.object({
  items: z.array(z.object({
    productId: z.coerce.number().int().positive(),
    quantity: z.coerce.number().int().min(1).max(999),
  })).min(1, 'অন্তত একটি পণ্য প্রয়োজন।'),
  reason: z.string().trim().max(500).optional(),
  acknowledgePaidChange: z.boolean().optional(),
});

router.put(
  '/admin/:id/items',
  authenticateAdmin,
  requirePermission('orders:write'),
  validateBody(editSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body as z.infer<typeof editSchema>;
    const [existing] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!existing) throw new AppError('অর্ডারটি পাওয়া যায়নি।', 404);

    const previousTotal = Number(existing.total);
    const result = await editOrderItems(id, body.items, {
      adminId: req.adminId!,
      reason: body.reason,
      acknowledgePaidChange: body.acknowledgePaidChange,
    });
    await logStaffAction({
      adminId: req.adminId, action: 'order.items_edited', module: 'orders', targetId: id,
      details: { previousTotal, newTotal: result.order.total }, ip: req.ip,
    });
    const detail = await getOrderWithDetail(id);
    return res.json({ success: true, message: 'অর্ডার আপডেট করা হয়েছে।', order: detail, data: detail, previousTotal, newTotal: result.order.total });
  })
);

// ── Admin: invoice ──────────────────────────────────────────────────────────
router.get(
  '/admin/:id/invoice',
  authenticateAdmin,
  requirePermission('orders:read'),
  asyncHandler(async (req, res) => {
    const data = await getInvoiceData(Number(req.params.id));
    return res.json({ success: true, invoice: data, data });
  })
);

router.get(
  '/admin/:id/invoice/print',
  authenticateAdmin,
  requirePermission('orders:read'),
  asyncHandler(async (req, res) => {
    const html = await renderInvoiceHtml(Number(req.params.id));
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  })
);

export default router;
