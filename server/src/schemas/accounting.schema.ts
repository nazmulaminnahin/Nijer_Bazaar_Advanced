import { pgTable, serial, varchar, text, numeric, integer, timestamp } from 'drizzle-orm/pg-core';
import { orders } from './orders.schema';

/** Money in/out tied to orders or manual entries. */
export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  reference: varchar('reference', { length: 60 }),
  type: varchar('type', { length: 20 }).notNull(), // income | expense | refund
  category: varchar('category', { length: 100 }).notNull().default('general'),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  paymentMethod: varchar('payment_method', { length: 30 }).notNull().default('cash'),
  status: varchar('status', { length: 20 }).notNull().default('completed'),
  description: text('description'),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
  adminId: integer('admin_id'),
  transactionDate: timestamp('transaction_date').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/** Operating expenses, separate data source from transactions. */
export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  reference: varchar('reference', { length: 60 }),
  title: varchar('title', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }).notNull().default('other'),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  paymentMethod: varchar('payment_method', { length: 30 }).notNull().default('cash'),
  description: text('description'),
  date: timestamp('date').notNull().defaultNow(),
  adminId: integer('admin_id'),
  receipt: text('receipt'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type Transaction = typeof transactions.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
