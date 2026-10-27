import { pgTable, serial, varchar, text, boolean, integer, timestamp, json } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

/** In-app notifications shown to customers. */
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull().default('info'),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  data: text('data'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const notificationTemplates = pgTable('notification_templates', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  channel: varchar('channel', { length: 20 }).notNull().default('email'), // email|sms|whatsapp|push|in_app
  event: varchar('event', { length: 60 }), // order_placed|order_status|broadcast ...
  subject: varchar('subject', { length: 255 }),
  body: text('body').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * Delivery log for every outbound message on every channel.
 * Status lifecycle: queued -> sent -> delivered | failed
 */
export const notificationLogs = pgTable('notification_logs', {
  id: serial('id').primaryKey(),
  channel: varchar('channel', { length: 20 }).notNull(),
  provider: varchar('provider', { length: 40 }),
  recipient: varchar('recipient', { length: 255 }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  subject: varchar('subject', { length: 255 }),
  body: text('body'),
  status: varchar('status', { length: 20 }).notNull().default('queued'),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  providerMessageId: varchar('provider_message_id', { length: 255 }),
  batchId: varchar('batch_id', { length: 60 }),
  meta: json('meta').$type<Record<string, unknown>>(),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type NotificationLog = typeof notificationLogs.$inferSelect;
