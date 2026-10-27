import { and, count, desc, eq, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm';
import { db } from '../config/db';
import type { DbClient } from '../config/db';
import {
  cart, coupons, inventory, inventoryLog, orderAuditLog, orderItems, orderStatusHistory, orders,
  productImages, products, users,
} from '../schemas/index';
import { AppError } from '../middleware/errorHandler';
import { generateOrderNumber, money, normalizePhone } from '../utils/helpers';
import { computeOrderTotals, quoteShipping } from './pricing';
import { loadShippingConfig } from './settings.service';
import { recordCouponUsage, validateCoupon } from './coupon.service';
import { notifyOrderEvent } from './notification.service';

export const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS_BN: Record<string, string> = {
  pending: 'পেন্ডিং', confirmed: 'কনফার্মড', processing: 'প্রসেসিং',
  shipped: 'শিপড', delivered: 'ডেলিভার্ড', cancelled: 'বাতিল', returned: 'রিটার্ন',
};

/** Allowed transitions — prevents e.g. delivered → pending. */
export const STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
};

export interface ShippingAddressInput {
  name: string;
  phone: string;
  address: string;
  division: string;
  district: string;
  thana: string;
  city?: string;
  postalCode?: string;
  email?: string;
  note?: string;
}

export interface PlaceOrderInput {
  items: Array<{ productId: number; quantity: number; variant?: string }>;
  shippingAddress: ShippingAddressInput;
  paymentMethod?: string;
  couponCode?: string;
  notes?: string;
  clearCart?: boolean;
}

async function nextSequence(dbc: DbClient, table: 'orders' | 'invoice'): Promise<number> {
  const [row] = await dbc.select({ value: count() }).from(orders);
  const base = Number(row?.value ?? 0);
  return table === 'orders' ? base + 1 : base + 1;
}

async function uniqueOrderNumber(dbc: DbClient): Promise<string> {
  for (let i = 0; i < 20; i += 1) {
    const candidate = generateOrderNumber(await nextSequence(dbc, 'orders') + i);
    const [clash] = await dbc.select({ id: orders.id }).from(orders).where(eq(orders.orderNumber, candidate)).limit(1);
    if (!clash) return candidate;
  }
  throw new AppError('Could not allocate an order number. Please retry.', 500);
}

async function uniqueInvoiceNumber(dbc: DbClient): Promise<string> {
  for (let i = 0; i < 30; i += 1) {
    const candidate = `INV-${10000 + (await nextSequence(dbc, 'invoice')) + i}`;
    const [clash] = await dbc.select({ id: orders.id }).from(orders).where(eq(orders.invoiceNumber, candidate)).limit(1);
    if (!clash) return candidate;
  }
  throw new AppError('Could not allocate an invoice number. Please retry.', 500);
}

export async function placeOrder(input: PlaceOrderInput, userId: number) {
  if (!input.items?.length) throw new AppError('আপনার কার্ট খালি।', 400);
  const address = input.shippingAddress;
  if (!address?.name || !address?.phone || !address?.address || !address?.district || !address?.thana || !address?.division) {
    throw new AppError('ডেলিভারির জন্য নাম, মোবাইল, সম্পূর্ণ ঠিকানা, বিভাগ, জেলা ও থানা প্রয়োজন।', 422);
  }

  const shippingConfig = await loadShippingConfig();

  return db.transaction(async (tx) => {
    // 1. Re-price every line from the database — client prices are ignored.
    const lines: Array<{ product: typeof products.$inferSelect; quantity: number; unitPrice: number; variant?: string }> = [];
    for (const item of input.items) {
      const [product] = await tx.select().from(products).where(eq(products.id, item.productId)).limit(1);
      if (!product || !product.isActive) {
        throw new AppError(`একটি পণ্য আর পাওয়া যাচ্ছে না (ID: ${item.productId})। কার্ট আপডেট করুন।`, 400);
      }
      const quantity = Math.max(1, Math.floor(Number(item.quantity)));
      if (product.stock < quantity) {
        throw new AppError(`"${product.name}" এর স্টক পর্যাপ্ত নয় (আছে ${product.stock} টি)।`, 400);
      }
      const sale = product.salePrice == null ? null : Number(product.salePrice);
      const unitPrice = sale && sale > 0 && sale < Number(product.price) ? sale : Number(product.price);
      lines.push({ product, quantity, unitPrice, variant: item.variant });
    }

    const subtotal = money(lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0));

    // 2. Coupon validation + discount, server-side
    let discount = 0;
    let couponId: number | null = null;
    if (input.couponCode) {
      const result = await validateCoupon(input.couponCode, subtotal, userId, tx as never);
      discount = result.discount;
      couponId = result.couponId;
    }

    // 3. Shipping from the configured policy
    const quote = quoteShipping({ district: address.district, subtotal, config: shippingConfig });
    let shippingCharge = quote.charge;
    if (input.couponCode) {
      const [coupon] = await tx.select().from(coupons).where(eq(coupons.code, input.couponCode.trim().toUpperCase())).limit(1);
      if (coupon?.type === 'free_shipping') {
        shippingCharge = 0;
        discount = Math.max(discount, 0);
      }
    }

    // 4. Authoritative totals
    const totals = computeOrderTotals({
      items: lines.map((l) => ({ price: l.unitPrice, quantity: l.quantity })),
      shippingCharge,
      discount,
    });

    const orderNumber = await uniqueOrderNumber(tx as never);
    const invoiceNumber = await uniqueInvoiceNumber(tx as never);

    const [order] = await tx
      .insert(orders)
      .values({
        orderNumber,
        invoiceNumber,
        userId,
        shippingAddress: { ...address, phone: normalizePhone(address.phone) },
        status: 'pending',
        paymentMethod: input.paymentMethod ?? 'cod',
        paymentStatus: 'pending',
        subtotal: String(totals.subtotal),
        discount: String(totals.discount),
        shippingCost: String(totals.shipping),
        total: String(totals.total),
        shippingZoneCode: quote.zoneCode,
        couponId,
        notes: input.notes ?? address.note ?? null,
        itemCount: totals.itemCount,
      })
      .returning();

    for (const line of lines) {
      const [image] = await tx.select({ url: productImages.imageUrl }).from(productImages).where(eq(productImages.productId, line.product.id)).limit(1);
      await tx.insert(orderItems).values({
        orderId: order.id,
        productId: line.product.id,
        productName: line.product.name,
        productSku: line.product.sku,
        productImage: image?.url ?? null,
        quantity: line.quantity,
        price: String(line.unitPrice),
        variant: line.variant ?? null,
      });

      // 5. Stock movement, guarded by the current stock value
      const [updated] = await tx
        .update(products)
        .set({ stock: sql`${products.stock} - ${line.quantity}`, totalSold: sql`${products.totalSold} + ${line.quantity}`, updatedAt: new Date() })
        .where(and(eq(products.id, line.product.id), gte(products.stock, line.quantity)))
        .returning({ stock: products.stock });
      if (!updated) throw new AppError(`"${line.product.name}" এর স্টক এইমাত্র পরিবর্তিত হয়েছে। আবার চেষ্টা করুন।`, 409);

      await tx.insert(inventoryLog).values({
        productId: line.product.id,
        type: 'sale',
        quantity: -line.quantity,
        previousStock: line.product.stock,
        newStock: updated.stock,
        reason: `Order ${orderNumber}`,
      });
      await tx
        .update(inventory)
        .set({ quantity: updated.stock, availableQuantity: updated.stock, updatedAt: new Date() })
        .where(eq(inventory.productId, line.product.id));
    }

    if (couponId) await recordCouponUsage(tx as never, { couponId, userId, orderId: order.id, discount: totals.discount });

    await tx.insert(orderStatusHistory).values({ orderId: order.id, status: 'pending', note: 'Order placed by customer', changedBy: userId });
    await tx.insert(orderAuditLog).values({ orderId: order.id, action: 'order.created', details: { totals, items: lines.length } });

    if (input.clearCart !== false) await tx.delete(cart).where(eq(cart.userId, userId));

    return { order, totals, quote };
  }).then(async (result) => {
    await notifyOrderEvent(result.order.id, 'placed');
    return result;
  });
}

export async function getOrderWithDetail(orderId: number, dbc: DbClient = db) {
  const [order] = await dbc.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return null;
  const items = await dbc.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const history = await dbc
    .select()
    .from(orderStatusHistory)
    .where(eq(orderStatusHistory.orderId, orderId))
    .orderBy(desc(orderStatusHistory.createdAt));
  const audit = await dbc.select().from(orderAuditLog).where(eq(orderAuditLog.orderId, orderId)).orderBy(desc(orderAuditLog.createdAt));
  const [customer] = order.userId
    ? await dbc.select({ id: users.id, name: users.name, email: users.email, phone: users.phone }).from(users).where(eq(users.id, order.userId)).limit(1)
    : [];

  return {
    ...serializeOrder(order),
    items: items.map(serializeOrderItem),
    statusHistory: history.map((h) => ({
      id: h.id,
      status: h.status,
      statusLabel: ORDER_STATUS_LABELS_BN[h.status] ?? h.status,
      note: h.note,
      changedBy: h.changedBy,
      createdAt: h.createdAt.toISOString(),
    })),
    auditTrail: audit.map((a) => ({ id: a.id, action: a.action, details: a.details, adminId: a.adminId, createdAt: a.createdAt.toISOString() })),
    customer: customer ?? null,
  };
}

export function serializeOrder(order: typeof orders.$inferSelect) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    invoiceNumber: order.invoiceNumber,
    userId: order.userId,
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS_BN[order.status] ?? order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    shippingCost: Number(order.shippingCost),
    total: Number(order.total),
    shippingZoneCode: order.shippingZoneCode,
    couponId: order.couponId,
    courierId: order.courierId,
    trackingNumber: order.trackingNumber,
    courierTrackingId: order.trackingNumber,
    shippingAddress: order.shippingAddress,
    customerName: order.shippingAddress?.name ?? '',
    customerPhone: order.shippingAddress?.phone ?? '',
    notes: order.notes,
    adminNotes: order.adminNotes,
    itemCount: order.itemCount,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    deliveredAt: order.deliveredAt ? order.deliveredAt.toISOString() : null,
  };
}

export function serializeOrderItem(item: typeof orderItems.$inferSelect) {
  const price = Number(item.price);
  return {
    id: item.id,
    productId: item.productId,
    productName: item.productName,
    name: item.productName,
    productSku: item.productSku,
    productImage: item.productImage,
    quantity: item.quantity,
    price,
    unitPrice: price,
    subtotal: Math.round(price * item.quantity),
    variant: item.variant,
  };
}

export interface AdminOrderFilters {
  status?: string;
  paymentStatus?: string;
  search?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
}

/** Distinct, correctly filtered admin listings (all / pending / shipped …). */
export async function listOrdersForAdmin(filters: AdminOrderFilters, dbc: DbClient = db) {
  const conditions = [];
  if (filters.status && filters.status !== 'all') {
    const statuses = filters.status.split(',').map((s) => s.trim()).filter(Boolean);
    conditions.push(inArray(orders.status, statuses));
  }
  if (filters.paymentStatus && filters.paymentStatus !== 'all') {
    conditions.push(eq(orders.paymentStatus, filters.paymentStatus));
  }
  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    const digits = filters.search.replace(/\D/g, '');
    conditions.push(
      or(
        ilike(orders.orderNumber, term),
        ilike(orders.invoiceNumber, term),
        sql`${orders.shippingAddress}->>'name' ILIKE ${term}`,
        digits ? sql`${orders.shippingAddress}->>'phone' LIKE ${`%${digits}%`}` : undefined
      )!
    );
  }
  if (filters.from) conditions.push(gte(orders.createdAt, new Date(filters.from)));
  if (filters.to) conditions.push(lte(orders.createdAt, new Date(`${filters.to}T23:59:59.999Z`)));

  const where = conditions.length ? and(...conditions) : undefined;
  const [totalRow] = await dbc.select({ value: count() }).from(orders).where(where);
  const rows = await dbc
    .select()
    .from(orders)
    .where(where)
    .orderBy(desc(orders.createdAt))
    .limit(filters.limit)
    .offset((filters.page - 1) * filters.limit);

  const ids = rows.map((r) => r.id);
  const items = ids.length ? await dbc.select().from(orderItems).where(inArray(orderItems.orderId, ids)) : [];

  const data = rows.map((row) => ({
    ...serializeOrder(row),
    items: items.filter((i) => i.orderId === row.id).map(serializeOrderItem),
  }));

  const statusCounts = await dbc
    .select({ status: orders.status, value: count() })
    .from(orders)
    .groupBy(orders.status);

  const total = Number(totalRow?.value ?? 0);
  return {
    data,
    pagination: { page: filters.page, limit: filters.limit, total, totalPages: Math.max(1, Math.ceil(total / filters.limit)) },
    counts: Object.fromEntries(statusCounts.map((s) => [s.status, Number(s.value)])),
  };
}

export async function updateOrderStatus(
  orderId: number,
  status: OrderStatus,
  opts: { adminId: number; note?: string; force?: boolean }
) {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) throw new AppError('অর্ডারটি পাওয়া যায়নি।', 404);
    if (!ORDER_STATUSES.includes(status)) throw new AppError('Invalid order status.', 422);
    if (order.status === status) return serializeOrder(order);

    const allowed = STATUS_FLOW[order.status as OrderStatus] ?? [];
    if (!allowed.includes(status) && !opts.force) {
      throw new AppError(
        `"${ORDER_STATUS_LABELS_BN[order.status]}" থেকে "${ORDER_STATUS_LABELS_BN[status]}" এ সরাসরি পরিবর্তন সম্ভব নয়।`,
        422
      );
    }

    // Cancelling/returning restores stock.
    if ((status === 'cancelled' || status === 'returned') && order.status !== 'cancelled' && order.status !== 'returned') {
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
      for (const item of items) {
        if (!item.productId) continue;
        const [product] = await tx.select({ stock: products.stock }).from(products).where(eq(products.id, item.productId)).limit(1);
        if (!product) continue;
        const nextStock = product.stock + item.quantity;
        await tx.update(products).set({ stock: nextStock, updatedAt: new Date() }).where(eq(products.id, item.productId));
        await tx.insert(inventoryLog).values({
          productId: item.productId, type: 'return', quantity: item.quantity,
          previousStock: product.stock, newStock: nextStock, reason: `Order ${order.orderNumber} ${status}`, adminId: opts.adminId,
        });
      }
    }

    const [updated] = await tx
      .update(orders)
      .set({
        status,
        updatedAt: new Date(),
        deliveredAt: status === 'delivered' ? new Date() : order.deliveredAt,
        paymentStatus: status === 'delivered' && order.paymentMethod === 'cod' ? 'paid' : order.paymentStatus,
      })
      .where(eq(orders.id, orderId))
      .returning();

    await tx.insert(orderStatusHistory).values({ orderId, status, note: opts.note ?? null, changedBy: opts.adminId });
    await tx.insert(orderAuditLog).values({
      orderId, adminId: opts.adminId, action: 'order.status_changed',
      details: { from: order.status, to: status, note: opts.note ?? null },
    });
    return serializeOrder(updated);
  }).then(async (order) => {
    await notifyOrderEvent(orderId, 'status_changed');
    return order;
  });
}

export interface OrderEditItem {
  productId: number;
  quantity: number;
}

/**
 * Admin/staff order editing: replaces the item set, recalculates every total
 * server-side, reconciles stock and writes an audit trail. When money has
 * already been collected the caller must acknowledge the adjustment.
 */
export async function editOrderItems(
  orderId: number,
  items: OrderEditItem[],
  opts: { adminId: number; reason?: string; acknowledgePaidChange?: boolean }
) {
  if (!Array.isArray(items) || items.length === 0) throw new AppError('অর্ডারে অন্তত একটি পণ্য থাকতে হবে।', 422);

  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) throw new AppError('অর্ডারটি পাওয়া যায়নি।', 404);
    if (['delivered', 'cancelled', 'returned'].includes(order.status)) {
      throw new AppError('ডেলিভারি সম্পন্ন, বাতিল বা রিটার্ন করা অর্ডার সম্পাদনা করা যায় না।', 409);
    }

    const existingItems = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    const previousTotal = Number(order.total);

    // Aggregate duplicates, validate quantities and stock.
    const requested = new Map<number, number>();
    for (const item of items) {
      const qty = Math.floor(Number(item.quantity));
      if (!Number.isFinite(qty) || qty < 1) throw new AppError('পরিমাণ ১ বা তার বেশি হতে হবে।', 422);
      if (qty > 999) throw new AppError('পরিমাণ অতিরিক্ত বড়।', 422);
      requested.set(item.productId, (requested.get(item.productId) ?? 0) + qty);
    }

    const resolved: Array<{ product: typeof products.$inferSelect; quantity: number; price: number }> = [];
    for (const [productId, quantity] of requested) {
      const [product] = await tx.select().from(products).where(eq(products.id, productId)).limit(1);
      if (!product) throw new AppError(`পণ্য পাওয়া যায়নি (ID: ${productId})।`, 404);
      const already = existingItems.find((i) => i.productId === productId)?.quantity ?? 0;
      const extraNeeded = quantity - already;
      if (extraNeeded > product.stock) {
        throw new AppError(`"${product.name}" এর স্টক পর্যাপ্ত নয় (আছে ${product.stock} টি)।`, 409);
      }
      const sale = product.salePrice == null ? null : Number(product.salePrice);
      const price = sale && sale > 0 && sale < Number(product.price) ? sale : Number(product.price);
      resolved.push({ product, quantity, price });
    }

    // Stock reconciliation for removed / reduced lines.
    for (const item of existingItems) {
      if (!item.productId) continue;
      const next = requested.get(item.productId) ?? 0;
      const delta = item.quantity - next;
      if (delta > 0) {
        const [product] = await tx.select({ stock: products.stock }).from(products).where(eq(products.id, item.productId)).limit(1);
        if (!product) continue;
        const nextStock = product.stock + delta;
        await tx.update(products).set({ stock: nextStock, updatedAt: new Date() }).where(eq(products.id, item.productId));
        await tx.insert(inventoryLog).values({
          productId: item.productId, type: 'adjustment', quantity: delta,
          previousStock: product.stock, newStock: nextStock, reason: `Order ${order.orderNumber} edited`, adminId: opts.adminId,
        });
      }
    }
    // Stock deduction for added / increased lines.
    for (const line of resolved) {
      const already = existingItems.find((i) => i.productId === line.product.id)?.quantity ?? 0;
      const extra = line.quantity - already;
      if (extra > 0) {
        const [updated] = await tx
          .update(products)
          .set({ stock: sql`${products.stock} - ${extra}`, updatedAt: new Date() })
          .where(and(eq(products.id, line.product.id), gte(products.stock, extra)))
          .returning({ stock: products.stock });
        if (!updated) throw new AppError(`"${line.product.name}" এর স্টক এইমাত্র পরিবর্তিত হয়েছে।`, 409);
        await tx.insert(inventoryLog).values({
          productId: line.product.id, type: 'adjustment', quantity: -extra,
          previousStock: updated.stock + extra, newStock: updated.stock,
          reason: `Order ${order.orderNumber} edited`, adminId: opts.adminId,
        });
      }
    }

    // Rebuild item rows.
    await tx.delete(orderItems).where(eq(orderItems.orderId, orderId));
    for (const line of resolved) {
      const [image] = await tx.select({ url: productImages.imageUrl }).from(productImages).where(eq(productImages.productId, line.product.id)).limit(1);
      await tx.insert(orderItems).values({
        orderId,
        productId: line.product.id,
        productName: line.product.name,
        productSku: line.product.sku,
        productImage: image?.url ?? null,
        quantity: line.quantity,
        price: String(line.price),
      });
    }

    // Re-price. The shipping policy is re-evaluated against the new subtotal,
    // so editing items can legitimately change the delivery charge.
    const subtotal = money(resolved.reduce((s, l) => s + l.price * l.quantity, 0));
    const shippingConfig = await loadShippingConfig(tx as never);
    const quote = quoteShipping({ district: order.shippingAddress?.district ?? 'Dhaka', subtotal, config: shippingConfig });
    const couponDiscount = Number(order.discount);
    const totals = computeOrderTotals({
      items: resolved.map((l) => ({ price: l.price, quantity: l.quantity })),
      shippingCharge: quote.charge,
      discount: couponDiscount,
    });

    // Money already collected must never change silently: the caller has to
    // explicitly acknowledge that an adjustment/refund is required.
    if (order.paymentStatus === 'paid' && totals.total !== previousTotal && !opts.acknowledgePaidChange) {
      throw new AppError(
        'এই অর্ডারের পেমেন্ট সম্পন্ন হয়েছে এবং নতুন মোট ভিন্ন হবে। সমন্বয়/রিফান্ড নিশ্চিত করে আবার চেষ্টা করুন।',
        409,
        { code: 'PAYMENT_ADJUSTMENT_REQUIRED', details: { previousTotal, newTotal: totals.total } }
      );
    }

    const [updated] = await tx
      .update(orders)
      .set({
        subtotal: String(totals.subtotal),
        discount: String(totals.discount),
        shippingCost: String(totals.shipping),
        total: String(totals.total),
        shippingZoneCode: quote.zoneCode,
        itemCount: totals.itemCount,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .returning();

    await tx.insert(orderAuditLog).values({
      orderId,
      adminId: opts.adminId,
      action: 'order.items_edited',
      details: {
        reason: opts.reason ?? null,
        previousTotal,
        newTotal: totals.total,
        previousItems: existingItems.map((i) => ({ productId: i.productId, name: i.productName, quantity: i.quantity, price: Number(i.price) })),
        newItems: resolved.map((l) => ({ productId: l.product.id, name: l.product.name, quantity: l.quantity, price: l.price })),
      },
    });

    return { order: serializeOrder(updated), totals, paymentStatus: updated.paymentStatus };
  });
}

export async function orderStats(dbc: DbClient = db) {
  const [row] = await dbc
    .select({
      totalOrders: count(),
      revenue: sql<number>`coalesce(sum(case when ${orders.status} not in ('cancelled','returned') then ${orders.total} else 0 end), 0)`,
      delivered: sql<number>`coalesce(sum(case when ${orders.status} = 'delivered' then 1 else 0 end), 0)`,
      pending: sql<number>`coalesce(sum(case when ${orders.status} = 'pending' then 1 else 0 end), 0)`,
    })
    .from(orders);
  return {
    totalOrders: Number(row?.totalOrders ?? 0),
    revenue: Number(row?.revenue ?? 0),
    delivered: Number(row?.delivered ?? 0),
    pending: Number(row?.pending ?? 0),
  };
}
