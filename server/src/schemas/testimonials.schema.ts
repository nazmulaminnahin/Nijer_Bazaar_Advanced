import { pgTable, serial, varchar, integer, boolean, text, timestamp } from 'drizzle-orm/pg-core';

/** Customer testimonials. Only rows with isPublished = true are shown publicly. */
export const testimonials = pgTable('testimonials', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  location: varchar('location', { length: 255 }),
  rating: integer('rating').notNull().default(5),
  message: text('message').notNull(),
  avatar: text('avatar'),
  isPublished: boolean('is_published').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdBy: integer('created_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Testimonial = typeof testimonials.$inferSelect;
