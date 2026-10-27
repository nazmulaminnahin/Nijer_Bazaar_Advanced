import {
  pgTable, serial, varchar,
  text, boolean, integer, timestamp
} from 'drizzle-orm/pg-core';
import { products } from './products.schema';
import { orders } from './orders.schema';

export const warehouses = pgTable('warehouses', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  address: text('address').notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const warehouseLocations = pgTable('warehouse_locations', {
  id: serial('id').primaryKey(),
  warehouseId: integer('warehouse_id')
    .notNull()
    .references(() => warehouses.id, { onDelete: 'cascade' }),
  shelf: varchar('shelf', { length: 50 }).notNull(),
  row: varchar('row', { length: 50 }),
  bin: varchar('bin', { length: 50 }),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const fulfillmentTasks = pgTable('fulfillment_tasks', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  assignedTo: integer('assigned_to'),
  // ✅ No .references() — avoids circular dependency
  status: varchar('status', { length: 30 }).notNull().default('pending'),
  pickedAt: timestamp('picked_at'),
  packedAt: timestamp('packed_at'),
  shippedAt: timestamp('shipped_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Warehouse = typeof warehouses.$inferSelect;
export type FulfillmentTask = typeof fulfillmentTasks.$inferSelect;