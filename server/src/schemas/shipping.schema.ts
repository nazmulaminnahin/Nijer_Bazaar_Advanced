import { pgTable, serial, varchar, numeric, boolean, json, timestamp } from 'drizzle-orm/pg-core';

/**
 * Delivery zones. `districts` holds district names; '*' means "everything else".
 * Free-shipping eligibility is decided per zone (see services/pricing.ts) so the
 * advertised policy and the checkout calculation can never drift apart.
 */
export const shippingZones = pgTable('shipping_zones', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 30 }).notNull().unique(),
  districts: json('districts').$type<string[]>().notNull().default([]),
  charge: numeric('charge', { precision: 10, scale: 2 }).notNull().default('0'),
  freeShippingEligible: boolean('free_shipping_eligible').notNull().default(false),
  freeShippingThreshold: numeric('free_shipping_threshold', { precision: 10, scale: 2 }),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: serial('sort_order'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type ShippingZone = typeof shippingZones.$inferSelect;
