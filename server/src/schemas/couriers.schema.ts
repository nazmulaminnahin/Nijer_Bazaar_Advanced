import { pgTable, serial, varchar, text, boolean, numeric, timestamp } from 'drizzle-orm/pg-core';

export const couriers = pgTable('couriers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  logo: text('logo'),
  trackingUrl: text('tracking_url'),
  contactPhone: varchar('contact_phone', { length: 20 }),
  contactEmail: varchar('contact_email', { length: 255 }),
  insideDhakaCharge: numeric('inside_dhaka_charge', { precision: 10, scale: 2 }).notNull().default('60'),
  outsideDhakaCharge: numeric('outside_dhaka_charge', { precision: 10, scale: 2 }).notNull().default('120'),
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Courier = typeof couriers.$inferSelect;
export type NewCourier = typeof couriers.$inferInsert;