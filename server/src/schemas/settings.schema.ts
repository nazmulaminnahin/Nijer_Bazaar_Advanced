import { pgTable, serial, varchar, text, timestamp } from 'drizzle-orm/pg-core';

export const settings = pgTable('settings', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value: text('value'),
  type: varchar('type', { length: 20 }).notNull().default('string'), // string|number|boolean|json
  group: varchar('group', { length: 50 }).notNull().default('general'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Setting = typeof settings.$inferSelect;
