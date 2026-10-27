import { pgTable, serial, varchar, boolean, integer, numeric, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { orders } from './orders.schema';
import { categories } from './categories.schema';

export const coupons = pgTable('coupons', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  description: varchar('description', { length: 500 }),
  type: varchar('type', { length: 20 }).notNull().default('percentage'), // percentage | flat | free_shipping
  value: numeric('value', { precision: 10, scale: 2 }).notNull().default('0'),
  minOrderAmount: numeric('min_order_amount', { precision: 10, scale: 2 }),
  maxDiscountAmount: numeric('max_discount_amount', { precision: 10, scale: 2 }),
  maxUses: integer('max_uses'),
  maxUsesPerUser: integer('max_uses_per_user').notNull().default(1),
  usedCount: integer('used_count').notNull().default(0),
  categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
  startsAt: timestamp('starts_at').notNull().defaultNow(),
  expiryDate: timestamp('expiry_date').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  terms: text('terms'),
  createdBy: integer('created_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const couponUsages = pgTable('coupon_usages', {
  id: serial('id').primaryKey(),
  couponId: integer('coupon_id').notNull().references(() => coupons.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
  discount: numeric('discount', { precision: 10, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type Coupon = typeof coupons.$inferSelect;
export type NewCoupon = typeof coupons.$inferInsert;
