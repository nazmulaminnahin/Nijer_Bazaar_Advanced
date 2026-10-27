import { pgTable, serial, varchar, text, boolean, integer, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * Customers.
 * Either email or phone may be missing, but at least one identifier is required
 * (enforced in the auth service). Both are unique when present so a single
 * account per identity is guaranteed.
 */
export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 20 }),
    password: varchar('password', { length: 255 }).notNull(),
    avatar: text('avatar'),
    role: varchar('role', { length: 20 }).notNull().default('customer'),
    isActive: boolean('is_active').notNull().default(true),
    isVerified: boolean('is_verified').notNull().default(false),
    loyaltyPoints: integer('loyalty_points').notNull().default(0),
    resetToken: varchar('reset_token', { length: 255 }),
    resetTokenExpiry: timestamp('reset_token_expiry'),
    lastLoginAt: timestamp('last_login_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex('users_email_unique').on(t.email),
    phoneIdx: uniqueIndex('users_phone_unique').on(t.phone),
  })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
