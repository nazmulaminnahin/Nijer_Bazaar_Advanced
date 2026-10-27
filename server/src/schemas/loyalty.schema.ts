import { pgTable, serial, integer, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { orders } from './orders.schema';

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
  type: varchar('type', { length: 20 }).notNull(),
  // earn | redeem | expire | bonus
  points: integer('points').notNull(),
  balance: integer('balance').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;