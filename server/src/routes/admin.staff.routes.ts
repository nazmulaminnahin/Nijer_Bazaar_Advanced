import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { and, count, desc, eq, ne, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../config/db';
import { admins, salaryPayments, staffLogs, staffProfiles, workAssignments } from '../schemas/index';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticateAdmin, requirePermission } from '../middleware/adminAuth';
import { validateBody } from '../middleware/validate';
import { ADMIN_ROLES, ALL_PERMISSIONS, permissionsForRole } from '../config/permissions';
import { logStaffAction } from '../services/audit.service';
import { isValidBdPhone, normalizePhone } from '../utils/helpers';

const router = Router();
router.use(authenticateAdmin);

const staffSchema = z.object({
  name: z.string().trim().min(2, 'নাম দিন।').max(255),
  email: z.string().trim().email('সঠিক ইমেইল দিন।').optional().or(z.literal('')),
  phone: z.string().trim().min(11, 'মোবাইল নম্বর দিন।'),
  password: z.string().min(8, 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষর।').optional(),
  role: z.enum(ADMIN_ROLES).default('staff'),
  isActive: z.boolean().optional(),
  permissions: z.array(z.string()).optional(),
  designation: z.string().trim().max(120).optional(),
  department: z.string().trim().max(120).optional(),
  monthlySalary: z.coerce.number().min(0).optional(),
  joinedAt: z.string().trim().optional(),
  employmentStatus: z.enum(['active', 'probation', 'resigned', 'terminated']).optional(),
});

function stripPassword<T extends { password?: string }>(row: T) {
  const { password, ...rest } = row;
  void password;
  return rest;
}

/** List staff + profile + assignment/salary aggregates (salary requires staff:salary). */
router.get(
  '/',
  requirePermission('staff:read'),
  asyncHandler(async (req, res) => {
    const canSeeSalary = (req.adminPermissions ?? []).includes('staff:salary');
    const rows = await db.select().from(admins).orderBy(desc(admins.createdAt));
    const profiles = await db.select().from(staffProfiles);
    const salary = await db
      .select({ adminId: salaryPayments.adminId, paid: sql<number>`sum(${salaryPayments.amount})`, payments: count() })
      .from(salaryPayments)
      .groupBy(salaryPayments.adminId);
    const tasks = await db
      .select({
        adminId: workAssignments.adminId,
        total: count(),
        completed: sql<number>`coalesce(sum(case when ${workAssignments.status} = 'completed' then 1 else 0 end), 0)`,
        inProgress: sql<number>`coalesce(sum(case when ${workAssignments.status} = 'in_progress' then 1 else 0 end), 0)`,
      })
      .from(workAssignments)
      .groupBy(workAssignments.adminId);

    const data = rows.map((row) => {
      const profile = profiles.find((p) => p.adminId === row.id);
      const pay = salary.find((s) => s.adminId === row.id);
      const task = tasks.find((t) => t.adminId === row.id);
      return {
        ...stripPassword(row),
        permissions: permissionsForRole(row.role, row.permissions ?? []),
        profile: profile
          ? {
              designation: profile.designation,
              department: profile.department,
              joinedAt: profile.joinedAt?.toISOString() ?? null,
              employmentStatus: profile.employmentStatus,
              emergencyContact: profile.emergencyContact,
              ...(canSeeSalary ? { monthlySalary: Number(profile.monthlySalary) } : {}),
            }
          : null,
        ...(canSeeSalary ? { salaryPaid: Number(pay?.paid ?? 0), salaryPayments: Number(pay?.payments ?? 0) } : {}),
        assignments: { total: Number(task?.total ?? 0), completed: Number(task?.completed ?? 0), inProgress: Number(task?.inProgress ?? 0) },
      };
    });

    return res.json({ success: true, staff: data, data, roles: ADMIN_ROLES, permissions: ALL_PERMISSIONS });
  })
);

router.post(
  '/',
  requirePermission('staff:write'),
  validateBody(staffSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof staffSchema>;
    if (input.role === 'super_admin' && req.adminRole !== 'super_admin') {
      throw new AppError('শুধুমাত্র সুপার অ্যাডমিন নতুন সুপার অ্যাডমিন তৈরি করতে পারেন।', 403);
    }
    if (!input.password) throw new AppError('নতুন স্টাফের জন্য পাসওয়ার্ড প্রয়োজন।', 422);

    const phone = normalizePhone(input.phone);
    if (!isValidBdPhone(phone)) throw new AppError('মোবাইল নম্বরটি সঠিক নয়।', 422);
    const email = input.email ? input.email.trim().toLowerCase() : null;

    const clash = await db
      .select({ id: admins.id })
      .from(admins)
      .where(or(eq(admins.phone, phone), email ? eq(admins.email, email) : undefined))
      .limit(1);
    if (clash.length) throw new AppError('এই ইমেইল বা মোবাইল নম্বর দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট আছে।', 409);

    const hashed = await bcrypt.hash(input.password, 12);
    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(admins)
        .values({
          name: input.name, email, phone, password: hashed, role: input.role,
          isActive: input.isActive ?? true, permissions: input.permissions ?? [], createdBy: req.adminId,
        })
        .returning();
      await tx.insert(staffProfiles).values({
        adminId: row.id,
        designation: input.designation ?? null,
        department: input.department ?? null,
        monthlySalary: String(input.monthlySalary ?? 0),
        joinedAt: input.joinedAt ? new Date(input.joinedAt) : new Date(),
        employmentStatus: input.employmentStatus ?? 'active',
      });
      return row;
    });

    await logStaffAction({ adminId: req.adminId, action: 'staff.create', module: 'staff', targetId: created.id, details: { role: created.role }, ip: req.ip });
    return res.status(201).json({ success: true, message: 'স্টাফ অ্যাকাউন্ট তৈরি হয়েছে।', data: stripPassword(created) });
  })
);

router.put(
  '/:id',
  requirePermission('staff:write'),
  validateBody(staffSchema.partial()),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(admins).where(eq(admins.id, id)).limit(1);
    if (!existing) throw new AppError('স্টাফ অ্যাকাউন্ট পাওয়া যায়নি।', 404);

    const input = req.body as Partial<z.infer<typeof staffSchema>>;
    if ((input.role === 'super_admin' || existing.role === 'super_admin') && req.adminRole !== 'super_admin') {
      throw new AppError('সুপার অ্যাডমিন অ্যাকাউন্ট পরিবর্তনের অনুমতি নেই।', 403);
    }

    const phone = input.phone ? normalizePhone(input.phone) : existing.phone;
    if (phone && !isValidBdPhone(phone)) throw new AppError('মোবাইল নম্বরটি সঠিক নয়।', 422);
    if (phone) {
      const clash = await db.select({ id: admins.id }).from(admins).where(and(eq(admins.phone, phone), ne(admins.id, id))).limit(1);
      if (clash.length) throw new AppError('এই মোবাইল নম্বর অন্য অ্যাকাউন্টে ব্যবহৃত হচ্ছে।', 409);
    }

    const email = input.email === undefined ? existing.email : input.email ? input.email.trim().toLowerCase() : null;
    if (email) {
      const clash = await db.select({ id: admins.id }).from(admins).where(and(eq(admins.email, email), ne(admins.id, id))).limit(1);
      if (clash.length) throw new AppError('এই ইমেইল অন্য অ্যাকাউন্টে ব্যবহৃত হচ্ছে।', 409);
    }

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(admins)
        .set({
          name: input.name ?? existing.name,
          email,
          phone,
          role: input.role ?? existing.role,
          isActive: input.isActive ?? existing.isActive,
          permissions: input.permissions ?? existing.permissions ?? [],
          ...(input.password ? { password: await bcrypt.hash(input.password, 12) } : {}),
          updatedAt: new Date(),
        })
        .where(eq(admins.id, id))
        .returning();

      if (input.designation !== undefined || input.department !== undefined || input.monthlySalary !== undefined || input.joinedAt !== undefined || input.employmentStatus !== undefined) {
        if (input.monthlySalary !== undefined && !(req.adminPermissions ?? []).includes('staff:salary')) {
          throw new AppError('বেতন পরিবর্তনের অনুমতি নেই।', 403);
        }
        const [profile] = await tx.select().from(staffProfiles).where(eq(staffProfiles.adminId, id)).limit(1);
        const values = {
          designation: input.designation ?? profile?.designation ?? null,
          department: input.department ?? profile?.department ?? null,
          monthlySalary: input.monthlySalary !== undefined ? String(input.monthlySalary) : profile?.monthlySalary ?? '0',
          joinedAt: input.joinedAt ? new Date(input.joinedAt) : profile?.joinedAt ?? null,
          employmentStatus: input.employmentStatus ?? profile?.employmentStatus ?? 'active',
          updatedAt: new Date(),
        };
        if (profile) await tx.update(staffProfiles).set(values).where(eq(staffProfiles.adminId, id));
        else await tx.insert(staffProfiles).values({ adminId: id, ...values });
      }
      return row;
    });

    await logStaffAction({ adminId: req.adminId, action: 'staff.update', module: 'staff', targetId: id, details: { role: updated.role }, ip: req.ip });
    return res.json({ success: true, message: 'স্টাফ তথ্য আপডেট হয়েছে।', data: stripPassword(updated) });
  })
);

router.delete(
  '/:id',
  requirePermission('staff:write'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (id === req.adminId) throw new AppError('নিজের অ্যাকাউন্ট মুছে ফেলা সম্ভব নয়।', 400);
    const [existing] = await db.select().from(admins).where(eq(admins.id, id)).limit(1);
    if (!existing) throw new AppError('স্টাফ অ্যাকাউন্ট পাওয়া যায়নি।', 404);
    if (existing.role === 'super_admin') throw new AppError('সুপার অ্যাডমিন অ্যাকাউন্ট মুছে ফেলা সম্ভব নয়।', 403);
    // Deactivate instead of delete so order/audit references stay valid.
    await db.update(admins).set({ isActive: false, updatedAt: new Date() }).where(eq(admins.id, id));
    await logStaffAction({ adminId: req.adminId, action: 'staff.deactivate', module: 'staff', targetId: id, ip: req.ip });
    return res.json({ success: true, message: 'স্টাফ অ্যাকাউন্ট নিষ্ক্রিয় করা হয়েছে।' });
  })
);

// ── Salary ──────────────────────────────────────────────────────────────────
router.get(
  '/:id/salary',
  requirePermission('staff:salary'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [profile] = await db.select().from(staffProfiles).where(eq(staffProfiles.adminId, id)).limit(1);
    const rows = await db.select().from(salaryPayments).where(eq(salaryPayments.adminId, id)).orderBy(desc(salaryPayments.paidAt));
    return res.json({
      success: true,
      monthlySalary: profile ? Number(profile.monthlySalary) : 0,
      payments: rows.map((r) => ({ ...r, amount: Number(r.amount), bonus: Number(r.bonus), deduction: Number(r.deduction) })),
      data: rows,
    });
  })
);

const salarySchema = z.object({
  periodMonth: z.string().regex(/^\d{4}-\d{2}$/, 'মাস YYYY-MM ফরম্যাটে দিন।'),
  amount: z.coerce.number().positive('বেতন ০ এর বেশি হতে হবে।'),
  bonus: z.coerce.number().min(0).optional(),
  deduction: z.coerce.number().min(0).optional(),
  method: z.enum(['cash', 'bkash', 'nagad', 'bank']).default('cash'),
  note: z.string().trim().max(500).optional(),
  paidAt: z.string().trim().optional(),
});

router.post(
  '/:id/salary',
  requirePermission('staff:salary'),
  validateBody(salarySchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const input = req.body as z.infer<typeof salarySchema>;
    const [account] = await db.select({ id: admins.id }).from(admins).where(eq(admins.id, id)).limit(1);
    if (!account) throw new AppError('স্টাফ পাওয়া যায়নি।', 404);

    const [duplicate] = await db
      .select({ id: salaryPayments.id })
      .from(salaryPayments)
      .where(and(eq(salaryPayments.adminId, id), eq(salaryPayments.periodMonth, input.periodMonth)))
      .limit(1);
    if (duplicate) throw new AppError('এই মাসের বেতন ইতিমধ্যে রেকর্ড করা হয়েছে।', 409);

    const [created] = await db
      .insert(salaryPayments)
      .values({
        adminId: id,
        periodMonth: input.periodMonth,
        amount: String(input.amount),
        bonus: String(input.bonus ?? 0),
        deduction: String(input.deduction ?? 0),
        method: input.method,
        note: input.note ?? null,
        paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
        recordedBy: req.adminId,
      })
      .returning();

    await logStaffAction({ adminId: req.adminId, action: 'salary.record', module: 'staff', targetId: id, details: { ...input, note: undefined }, ip: req.ip });
    return res.status(201).json({ success: true, message: 'বেতন রেকর্ড করা হয়েছে।', data: created });
  })
);

// ── Work assignments / progress ─────────────────────────────────────────────
router.get(
  '/:id/assignments',
  requirePermission('staff:read'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const rows = await db.select().from(workAssignments).where(eq(workAssignments.adminId, id)).orderBy(desc(workAssignments.createdAt));
    return res.json({ success: true, assignments: rows, data: rows });
  })
);

const assignmentSchema = z.object({
  title: z.string().trim().min(3, 'কাজের শিরোনাম দিন।').max(255),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(['not_started', 'in_progress', 'completed', 'on_hold']).default('not_started'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  dueDate: z.string().trim().optional(),
  progressNote: z.string().trim().max(1000).optional(),
});

router.post(
  '/:id/assignments',
  requirePermission('staff:write'),
  validateBody(assignmentSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const input = req.body as z.infer<typeof assignmentSchema>;
    const [account] = await db.select({ id: admins.id }).from(admins).where(eq(admins.id, id)).limit(1);
    if (!account) throw new AppError('স্টাফ পাওয়া যায়নি।', 404);
    const [created] = await db
      .insert(workAssignments)
      .values({
        adminId: id,
        title: input.title,
        description: input.description ?? null,
        status: input.status,
        priority: input.priority,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        progressNote: input.progressNote ?? null,
        assignedBy: req.adminId,
        completedAt: input.status === 'completed' ? new Date() : null,
      })
      .returning();
    await logStaffAction({ adminId: req.adminId, action: 'assignment.create', module: 'staff', targetId: id, details: { title: input.title }, ip: req.ip });
    return res.status(201).json({ success: true, message: 'কাজ যোগ করা হয়েছে।', data: created });
  })
);

router.put(
  '/assignments/:assignmentId',
  requirePermission('staff:write'),
  validateBody(assignmentSchema.partial()),
  asyncHandler(async (req, res) => {
    const assignmentId = Number(req.params.assignmentId);
    const [existing] = await db.select().from(workAssignments).where(eq(workAssignments.id, assignmentId)).limit(1);
    if (!existing) throw new AppError('কাজ পাওয়া যায়নি।', 404);
    const input = req.body as Partial<z.infer<typeof assignmentSchema>>;
    const [updated] = await db
      .update(workAssignments)
      .set({
        title: input.title ?? existing.title,
        description: input.description ?? existing.description,
        status: input.status ?? existing.status,
        priority: input.priority ?? existing.priority,
        dueDate: input.dueDate ? new Date(input.dueDate) : existing.dueDate,
        progressNote: input.progressNote ?? existing.progressNote,
        completedAt: (input.status ?? existing.status) === 'completed' ? existing.completedAt ?? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(workAssignments.id, assignmentId))
      .returning();
    return res.json({ success: true, message: 'কাজের অবস্থা আপডেট হয়েছে।', data: updated });
  })
);

// ── Audit log ───────────────────────────────────────────────────────────────
router.get(
  '/logs',
  requirePermission('staff:read'),
  asyncHandler(async (req, res) => {
    const limit = Math.min(200, Number(req.query.limit ?? 50));
    const rows = await db.select().from(staffLogs).orderBy(desc(staffLogs.createdAt)).limit(limit);
    return res.json({ success: true, logs: rows, data: rows });
  })
);

export default router;
