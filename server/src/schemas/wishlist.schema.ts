import { pgTable, serial, integer, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { products } from './products.schema';

export const wishlist = pgTable('wishlist', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({ userProduct: uniqueIndex('wishlist_user_product_unique').on(t.userId, t.productId) }));

export type WishlistItem = typeof wishlist.$inferSelect;
