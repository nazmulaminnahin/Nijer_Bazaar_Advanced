import { pgTable, serial, varchar, text, boolean, integer, numeric, timestamp, json, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * Administrators, managers and staff.
 * `role` is one of: super_admin | manager | staff | support
 * `permissions` holds an extra allow-list on top of the role defaults.
 */
export const admins = pgTable(
  'admins',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 20 }),
    password: varchar('password', { length: 255 }).notNull(),
    role: varchar('role', { length: 30 }).notNull().default('staff'),
    permissions: json('permissions').$type<string[]>().default([]),
    avatar: text('avatar'),
    isActive: boolean('is_active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at'),
    createdBy: integer('created_by'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex('admins_email_unique').on(t.email),
    phoneIdx: uniqueIndex('admins_phone_unique').on(t.phone),
  })
);

export const adminPermissions = pgTable('admin_permissions', {
  id: serial('id').primaryKey(),
  adminId: integer('admin_id').notNull().references(() => admins.id, { onDelete: 'cascade' }),
  permission: varchar('permission', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type Admin = typeof admins.$inferSelect;
export type NewAdmin = typeof admins.$inferInsert;

/** HR record, one per admin/staff member. Salary is sensitive. */
export const staffProfiles = pgTable('staff_profiles', {
  id: serial('id').primaryKey(),
  adminId: integer('admin_id').notNull().references(() => admins.id, { onDelete: 'cascade' }),
  designation: varchar('designation', { length: 120 }),
  department: varchar('department', { length: 120 }),
  monthlySalary: numeric('monthly_salary', { precision: 12, scale: 2 }).notNull().default('0'),
  joinedAt: timestamp('joined_at'),
  employmentStatus: varchar('employment_status', { length: 30 }).notNull().default('active'),
  address: text('address'),
  emergencyContact: varchar('emergency_contact', { length: 30 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({ adminIdx: uniqueIndex('staff_profiles_admin_unique').on(t.adminId) }));

export const salaryPayments = pgTable('salary_payments', {
  id: serial('id').primaryKey(),
  adminId: integer('admin_id').notNull().references(() => admins.id, { onDelete: 'cascade' }),
  periodMonth: varchar('period_month', { length: 7 }).notNull(), // YYYY-MM
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  bonus: numeric('bonus', { precision: 12, scale: 2 }).notNull().default('0'),
  deduction: numeric('deduction', { precision: 12, scale: 2 }).notNull().default('0'),
  method: varchar('method', { length: 30 }).notNull().default('cash'),
  paidAt: timestamp('paid_at').notNull().defaultNow(),
  note: text('note'),
  recordedBy: integer('recorded_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const workAssignments = pgTable('work_assignments', {
  id: serial('id').primaryKey(),
  adminId: integer('admin_id').notNull().references(() => admins.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).notNull().default('not_started'), // not_started|in_progress|completed|on_hold
  priority: varchar('priority', { length: 20 }).notNull().default('normal'),
  dueDate: timestamp('due_date'),
  progressNote: text('progress_note'),
  assignedBy: integer('assigned_by'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const staffLogs = pgTable('staff_logs', {
  id: serial('id').primaryKey(),
  adminId: integer('admin_id'),
  action: varchar('action', { length: 255 }).notNull(),
  module: varchar('module', { length: 100 }).notNull().default('general'),
  targetId: integer('target_id'),
  details: text('details'),
  ipAddress: varchar('ip_address', { length: 50 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
