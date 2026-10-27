import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { and, eq, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../config/db';
import { admins, users } from '../schemas/index';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { rateLimit } from '../middleware/rateLimit';
import { validateBody } from '../middleware/validate';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authenticateAdmin, AdminAuthRequest } from '../middleware/adminAuth';
import { signAdminToken, signCustomerToken } from '../utils/jwt';
import { isValidBdPhone, isValidEmail, normalizePhone } from '../utils/helpers';
import { permissionsForRole } from '../config/permissions';
import { logStaffAction } from '../services/audit.service';

const router = Router();
const BCRYPT_ROUNDS = 12;

const identifier = z.string().trim().min(3, 'ইমেইল বা মোবাইল নম্বর দিন।');

const registerSchema = z.object({
  name: z.string().trim().min(2, 'নাম কমপক্ষে ২ অক্ষরের হতে হবে।').max(255),
  email: z.string().trim().optional().or(z.literal('')),
  phone: z.string().trim().optional().or(z.literal('')),
  password: z.string().min(8, 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।').max(128),
});

const loginSchema = z.object({
  identifier: identifier.optional(),
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  password: z.string().min(1, 'পাসওয়ার্ড দিন।'),
});

const adminLoginSchema = z.object({
  identifier: identifier.optional(),
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  password: z.string().min(1, 'পাসওয়ার্ড দিন।'),
});

function publicUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    email: user.email ?? '',
    phone: user.phone ?? '',
    avatar: user.avatar,
    role: user.role,
    loyaltyPoints: user.loyaltyPoints,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
  };
}

function publicAdmin(admin: typeof admins.$inferSelect) {
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email ?? '',
    phone: admin.phone ?? '',
    role: admin.role,
    avatar: admin.avatar,
    permissions: permissionsForRole(admin.role, admin.permissions ?? []),
  };
}

// ── Customer registration ────────────────────────────────────────────────────
router.post(
  '/register',
  rateLimit({ windowMs: 10 * 60_000, max: 20, keyPrefix: 'register:' }),
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, password } = req.body as z.infer<typeof registerSchema>;
    const emailRaw = String(req.body.email ?? '').trim().toLowerCase();
    const email = emailRaw || null;
    const phone = normalizePhone(req.body.phone) || null;

    if (!email && !phone) throw new AppError('ইমেইল অথবা মোবাইল নম্বর — অন্তত একটি দিন।', 422);
    if (email && !isValidEmail(email)) throw new AppError('ইমেইলের ঠিকানাটি সঠিক নয়।', 422);
    if (phone && !isValidBdPhone(phone)) throw new AppError('মোবাইল নম্বরটি সঠিক নয় (যেমন: 01712345678)।', 422);

    const existing = await db
      .select({ id: users.id, email: users.email, phone: users.phone })
      .from(users)
      .where(or(email ? eq(users.email, email) : undefined, phone ? eq(users.phone, phone) : undefined))
      .limit(1);
    if (existing.length) throw new AppError('এই ইমেইল বা মোবাইল নম্বর দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট আছে।', 409);

    const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const [created] = await db.insert(users).values({ name, email, phone, password: hashed }).returning();
    const token = signCustomerToken({ userId: created.id, role: 'customer' });
    return res.status(201).json({ success: true, token, user: publicUser(created) });
  })
);

// ── Customer login (email OR phone) ──────────────────────────────────────────
router.post(
  '/login',
  rateLimit({ windowMs: 10 * 60_000, max: 10, keyPrefix: 'login:' }),
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const rawIdentifier = String(req.body.identifier ?? req.body.email ?? req.body.phone ?? '').trim();
    const password = String(req.body.password ?? '');
    if (!rawIdentifier) throw new AppError('ইমেইল বা মোবাইল নম্বর দিন।', 422);

    const isEmail = rawIdentifier.includes('@');
    const email = isEmail ? rawIdentifier.toLowerCase() : null;
    const phone = isEmail ? null : normalizePhone(rawIdentifier);

    // Same generic error for "no such account" and "wrong password" so the
    // endpoint cannot be used to enumerate accounts.
    const invalid = new AppError('ইমেইল/মোবাইল অথবা পাসওয়ার্ড সঠিক নয়।', 401);

    const [account] = await db
      .select()
      .from(users)
      .where(isEmail ? eq(users.email, email!) : eq(users.phone, phone!))
      .limit(1);
    if (!account) throw invalid;
    if (!account.isActive) throw new AppError('এই অ্যাকাউন্টটি নিষ্ক্রিয় করা হয়েছে।', 403);

    const ok = await bcrypt.compare(password, account.password);
    if (!ok) throw invalid;

    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, account.id));
    const token = signCustomerToken({ userId: account.id, role: 'customer' });
    return res.json({ success: true, token, user: publicUser(account) });
  })
);

// ── Admin & staff login (email OR phone) ─────────────────────────────────────
router.post(
  '/admin/login',
  rateLimit({ windowMs: 10 * 60_000, max: 8, keyPrefix: 'admin-login:' }),
  validateBody(adminLoginSchema),
  asyncHandler(async (req, res) => {
    const rawIdentifier = String(req.body.identifier ?? req.body.email ?? req.body.phone ?? '').trim();
    const password = String(req.body.password ?? '');
    if (!rawIdentifier || !password) throw new AppError('আইডি ও পাসওয়ার্ড দিন।', 422);

    const isEmail = rawIdentifier.includes('@');
    const email = isEmail ? rawIdentifier.toLowerCase() : null;
    const phone = isEmail ? null : normalizePhone(rawIdentifier);
    const invalid = new AppError('আইডি অথবা পাসওয়ার্ড সঠিক নয়।', 401);

    const [account] = await db
      .select()
      .from(admins)
      .where(
        and(
          isEmail ? eq(admins.email, email!) : eq(admins.phone, phone!),
          eq(admins.isActive, true)
        )
      )
      .limit(1);
    if (!account) throw invalid;

    const ok = await bcrypt.compare(password, account.password);
    if (!ok) throw invalid;

    await db.update(admins).set({ lastLoginAt: new Date() }).where(eq(admins.id, account.id));
    await logStaffAction({ adminId: account.id, action: 'login', module: 'auth', ip: req.ip });

    const token = signAdminToken({ adminId: account.id, role: account.role });
    return res.json({ success: true, token, admin: publicAdmin(account) });
  })
);

// ── Profiles ─────────────────────────────────────────────────────────────────
router.get(
  '/profile',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const [account] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
    if (!account) throw new AppError('Account not found.', 404);
    return res.json({ success: true, user: publicUser(account), data: publicUser(account) });
  })
);

router.get(
  '/admin/me',
  authenticateAdmin,
  asyncHandler(async (req: AdminAuthRequest, res) => {
    const [account] = await db.select().from(admins).where(eq(admins.id, req.adminId!)).limit(1);
    if (!account) throw new AppError('Account not found.', 404);
    return res.json({ success: true, admin: publicAdmin(account) });
  })
);

const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(255).optional(),
  email: z.string().trim().optional().or(z.literal('')),
  phone: z.string().trim().optional().or(z.literal('')),
  avatar: z.string().trim().optional(),
});

router.put(
  '/profile',
  authenticate,
  validateBody(updateProfileSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { name, avatar } = req.body as z.infer<typeof updateProfileSchema>;
    const emailRaw = req.body.email === undefined ? undefined : String(req.body.email).trim().toLowerCase();
    const phoneRaw = req.body.phone === undefined ? undefined : normalizePhone(req.body.phone);

    if (emailRaw && !isValidEmail(emailRaw)) throw new AppError('ইমেইলের ঠিকানাটি সঠিক নয়।', 422);
    if (phoneRaw && !isValidBdPhone(phoneRaw)) throw new AppError('মোবাইল নম্বরটি সঠিক নয়।', 422);

    if (emailRaw) {
      const clash = await db.select({ id: users.id }).from(users).where(eq(users.email, emailRaw)).limit(1);
      if (clash.length && clash[0].id !== req.userId) throw new AppError('এই ইমেইল অন্য অ্যাকাউন্টে ব্যবহৃত হচ্ছে।', 409);
    }
    if (phoneRaw) {
      const clash = await db.select({ id: users.id }).from(users).where(eq(users.phone, phoneRaw)).limit(1);
      if (clash.length && clash[0].id !== req.userId) throw new AppError('এই মোবাইল নম্বর অন্য অ্যাকাউন্টে ব্যবহৃত হচ্ছে।', 409);
    }

    const [updated] = await db
      .update(users)
      .set({
        ...(name ? { name } : {}),
        ...(emailRaw !== undefined ? { email: emailRaw || null } : {}),
        ...(phoneRaw !== undefined ? { phone: phoneRaw || null } : {}),
        ...(avatar !== undefined ? { avatar } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, req.userId!))
      .returning();
    return res.json({ success: true, user: publicUser(updated), data: publicUser(updated) });
  })
);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'বর্তমান পাসওয়ার্ড দিন।'),
  newPassword: z.string().min(8, 'নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।'),
});

router.post(
  '/change-password',
  authenticate,
  validateBody(changePasswordSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { currentPassword, newPassword } = req.body as z.infer<typeof changePasswordSchema>;
    const [account] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
    if (!account) throw new AppError('Account not found.', 404);
    const ok = await bcrypt.compare(currentPassword, account.password);
    if (!ok) throw new AppError('বর্তমান পাসওয়ার্ডটি সঠিক নয়।', 400);
    const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await db.update(users).set({ password: hashed, updatedAt: new Date() }).where(eq(users.id, account.id));
    return res.json({ success: true, message: 'পাসওয়ার্ড পরিবর্তন করা হয়েছে।' });
  })
);

export default router;
