import { pgTable, serial, integer, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { products } from './products.schema';
import { orders } from './orders.schema';

export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
  rating: integer('rating').notNull(),
  // 1 to 5
  comment: text('comment'),
  isVerified: boolean('is_verified').notNull().default(false),
  isApproved: boolean('is_approved').notNull().default(true),
  adminReply: text('admin_reply'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;