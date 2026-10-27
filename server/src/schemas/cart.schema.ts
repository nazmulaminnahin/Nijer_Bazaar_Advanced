import { pgTable, serial, integer, numeric, varchar, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { products } from './products.schema';

export const cart = pgTable('cart', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').notNull().default(1),
  selectedVariant: varchar('selected_variant', { length: 255 }),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type CartItem = typeof cart.$inferSelect;
export type NewCartItem = typeof cart.$inferInsert;
