import { pgTable, serial, varchar, numeric, boolean, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { orders } from './orders.schema';

export const giftCards = pgTable('gift_cards', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  initialAmount: numeric('initial_amount', { precision: 10, scale: 2 }).notNull(),
  remainingAmount: numeric('remaining_amount', { precision: 10, scale: 2 }).notNull(),
  purchasedBy: integer('purchased_by').references(() => users.id, { onDelete: 'set null' }),
  usedBy: integer('used_by').references(() => users.id, { onDelete: 'set null' }),
  recipientName: varchar('recipient_name', { length: 255 }),
  recipientPhone: varchar('recipient_phone', { length: 20 }),
  message: text('message'),
  design: varchar('design', { length: 40 }).notNull().default('classic'),
  status: varchar('status', { length: 20 }).notNull().default('active'), // active|redeemed|expired|inactive
  expiryDate: timestamp('expiry_date'),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: integer('created_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/** Immutable ledger — every balance movement is recorded here. */
export const giftCardTransactions = pgTable('gift_card_transactions', {
  id: serial('id').primaryKey(),
  giftCardId: integer('gift_card_id').notNull().references(() => giftCards.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 20 }).notNull(), // issue | redeem | adjust | refund
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  balanceAfter: numeric('balance_after', { precision: 10, scale: 2 }).notNull(),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
  note: text('note'),
  adminId: integer('admin_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type GiftCard = typeof giftCards.$inferSelect;
export type GiftCardTransaction = typeof giftCardTransactions.$inferSelect;
