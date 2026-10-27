import { pgTable, serial, varchar, numeric, boolean, integer, json, text, timestamp } from 'drizzle-orm/pg-core';

export const flashSales = pgTable('flash_sales', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 20 }).notNull().default('percentage'), // percentage | flat
  value: numeric('value', { precision: 10, scale: 2 }).notNull(),
  productIds: json('product_ids').$type<number[]>().notNull().default([]),
  categoryIds: json('category_ids').$type<number[]>().notNull().default([]),
  startAt: timestamp('start_at').notNull(),
  endAt: timestamp('end_at').notNull(),
  stockLimit: integer('stock_limit'),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: integer('created_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type FlashSale = typeof flashSales.$inferSelect;
