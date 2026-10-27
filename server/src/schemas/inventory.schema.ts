import {
  pgTable, serial, integer,
  varchar, text, timestamp
} from 'drizzle-orm/pg-core';
import { products } from './products.schema';

export const inventory = pgTable('inventory', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').notNull().default(0),
  reservedQuantity: integer('reserved_quantity').notNull().default(0),
  availableQuantity: integer('available_quantity').notNull().default(0),
  lowStockAlert: integer('low_stock_alert').notNull().default(10),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const inventoryLog = pgTable('inventory_log', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 20 }).notNull(),
  quantity: integer('quantity').notNull(),
  previousStock: integer('previous_stock').notNull(),
  newStock: integer('new_stock').notNull(),
  reason: text('reason'),
  adminId: integer('admin_id'),
  // ✅ No .references() here — avoids circular dependency
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type InventoryItem = typeof inventory.$inferSelect;
export type InventoryLogEntry = typeof inventoryLog.$inferSelect;