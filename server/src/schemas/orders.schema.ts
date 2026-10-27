import { pgTable, serial, integer, varchar, text, numeric, timestamp, json } from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { products } from './products.schema';
import { couriers } from './couriers.schema';
import { coupons } from './coupons.schema';

export interface ShippingAddressSnapshot {
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

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderNumber: varchar('order_number', { length: 50 }).notNull().unique(),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull().unique(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  shippingAddress: json('shipping_address').$type<ShippingAddressSnapshot>().notNull(),
  status: varchar('status', { length: 30 }).notNull().default('pending'),
  paymentMethod: varchar('payment_method', { length: 20 }).notNull().default('cod'),
  paymentStatus: varchar('payment_status', { length: 20 }).notNull().default('pending'),
  subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
  shippingCost: numeric('shipping_cost', { precision: 10, scale: 2 }).notNull().default('0'),
  discount: numeric('discount', { precision: 10, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 10, scale: 2 }).notNull(),
  shippingZoneCode: varchar('shipping_zone_code', { length: 30 }),
  couponId: integer('coupon_id').references(() => coupons.id, { onDelete: 'set null' }),
  courierId: integer('courier_id').references(() => couriers.id, { onDelete: 'set null' }),
  trackingNumber: varchar('tracking_number', { length: 255 }),
  estimatedDelivery: timestamp('estimated_delivery'),
  deliveredAt: timestamp('delivered_at'),
  notes: text('notes'),
  adminNotes: text('admin_notes'),
  itemCount: integer('item_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
  productName: varchar('product_name', { length: 500 }).notNull(),
  productSku: varchar('product_sku', { length: 100 }),
  productImage: text('product_image'),
  quantity: integer('quantity').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  variant: varchar('variant', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const orderStatusHistory = pgTable('order_status_history', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 30 }).notNull(),
  note: text('note'),
  changedBy: integer('changed_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/** Audit trail for order edits (items, address, totals). */
export const orderAuditLog = pgTable('order_audit_log', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  adminId: integer('admin_id'),
  action: varchar('action', { length: 60 }).notNull(),
  details: json('details').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
