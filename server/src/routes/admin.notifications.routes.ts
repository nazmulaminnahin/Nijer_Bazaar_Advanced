import { Router } from 'express';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../config/db';
import { notificationLogs, notificationTemplates } from '../schemas/index';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticateAdmin, requirePermission } from '../middleware/adminAuth';
import { validateBody } from '../middleware/validate';
import {
  getProvider, notificationStats, providerStatus, retryNotification, sendNotification,
} from '../services/notification.service';
import { getSettings } from '../services/settings.service';
import { logStaffAction } from '../services/audit.service';
import { paginate } from '../utils/helpers';
import type { Channel } from '../services/notifications/types';

const router = Router();
router.use(authenticateAdmin, requirePermission('notifications:read'));

/** Provider status is reported honestly: configured ≠ delivered. */
router.get(
  '/providers',
  asyncHandler(async (_req, res) => {
    const settings = await getSettings();
    const providers = providerStatus().map((p) => ({
      ...p,
      enabled: settings[`notify_${p.channel}_enabled`] === 'true',
      enabledKey: `notify_${p.channel}_enabled`,
    }));
    return res.json({ success: true, providers, data: providers });
  })
);

const testSchema = z.object({
  channel: z.enum(['email', 'sms', 'whatsapp', 'push']),
  to: z.string().trim().min(3, 'প্রাপকের ঠিকানা দিন।'),
  message: z.string().trim().max(1000).optional(),
});

router.post(
  '/test',
  requirePermission('notifications:write'),
  validateBody(testSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof testSchema>;
    const provider = getProvider(input.channel as Channel);
    if (!provider) throw new AppError('Unknown channel.', 400);
    if (!provider.isConfigured()) {
      return res.status(503).json({
        success: false,
        configured: false,
        message: `${input.channel} চ্যানেল এখনো কনফিগার করা হয়নি।`,
        hint: provider.configurationHint(),
      });
    }
    try {
      const result = await provider.send({
        to: input.to,
        subject: 'Nijer Bazaar test message',
        body: input.message ?? 'This is a test notification from Nijer Bazaar admin panel.',
      });
      await logStaffAction({ adminId: req.adminId, action: 'notification.test', module: 'notifications', details: { channel: input.channel }, ip: req.ip });
      return res.json({ success: true, configured: true, message: 'টেস্ট মেসেজ পাঠানো হয়েছে।', providerMessageId: result.providerMessageId });
    } catch (err) {
      return res.status(502).json({ success: false, configured: true, message: 'প্রোভাইডার মেসেজ গ্রহণ করেনি।', error: (err as Error).message });
    }
  })
);

const sendSchema = z.object({
  channels: z.array(z.enum(['email', 'sms', 'whatsapp', 'push'])).min(1, 'অন্তত একটি চ্যানেল নির্বাচন করুন।'),
  subject: z.string().trim().max(255).optional(),
  body: z.string().trim().min(1, 'বার্তা লিখুন।').max(5000),
  userIds: z.array(z.coerce.number().int().positive()).optional(),
  group: z.enum(['all', 'customers', 'recent_buyers']).optional(),
  templateName: z.string().trim().max(100).optional(),
  preview: z.boolean().optional(),
});

router.post(
  '/send',
  requirePermission('notifications:write'),
  validateBody(sendSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof sendSchema>;
    if (!input.userIds?.length && !input.group) throw new AppError('প্রাপক নির্বাচন করুন (ব্যক্তি, গ্রুপ বা সবাই)।', 422);

    if (input.preview) {
      return res.json({
        success: true,
        preview: { subject: input.subject ?? '', body: input.body, channels: input.channels, audience: input.userIds?.length ? `${input.userIds.length} জন নির্দিষ্ট গ্রাহক` : input.group },
      });
    }

    const result = await sendNotification({
      channels: input.channels as Channel[],
      subject: input.subject,
      body: input.body,
      userIds: input.userIds,
      group: input.group,
      createdBy: req.adminId,
      meta: { templateName: input.templateName ?? null },
    });
    await logStaffAction({ adminId: req.adminId, action: 'notification.send', module: 'notifications', details: { channels: input.channels, sent: result.sent, failed: result.failed }, ip: req.ip });

    return res.json({
      success: true,
      message: `পাঠানো হয়েছে ${result.sent} টি, ব্যর্থ ${result.failed} টি, বাদ ${result.skipped} টি।`,
      ...result,
      data: result,
    });
  })
);

router.get(
  '/logs',
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = paginate(req.query as Record<string, unknown>, 25);
    const channel = String(req.query.channel ?? '');
    const status = String(req.query.status ?? '');
    const conditions = [];
    if (channel && channel !== 'all') conditions.push(eq(notificationLogs.channel, channel));
    if (status && status !== 'all') conditions.push(eq(notificationLogs.status, status));
    const where = conditions.length ? and(...conditions) : undefined;

    const [totalRow] = await db.select({ value: count() }).from(notificationLogs).where(where);
    const rows = await db.select().from(notificationLogs).where(where).orderBy(desc(notificationLogs.createdAt)).limit(limit).offset(offset);
    const total = Number(totalRow?.value ?? 0);
    const stats = await notificationStats();

    return res.json({
      success: true,
      logs: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), sentAt: r.sentAt?.toISOString() ?? null })),
      data: rows,
      total,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      stats,
    });
  })
);

router.post(
  '/logs/:id/retry',
  requirePermission('notifications:write'),
  asyncHandler(async (req, res) => {
    const result = await retryNotification(Number(req.params.id));
    if (result.status === 'sent') return res.json({ success: true, message: 'মেসেজ আবার পাঠানো হয়েছে।', ...result });
    return res.status(502).json({ success: false, message: 'আবার পাঠানো সম্ভব হয়নি।', ...result });
  })
);

router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const data = await notificationStats();
    return res.json({ success: true, stats: data, data });
  })
);

// ── Templates ───────────────────────────────────────────────────────────────
const templateSchema = z.object({
  name: z.string().trim().min(2, 'টেমপ্লেটের নাম দিন।').max(100),
  channel: z.enum(['email', 'sms', 'whatsapp', 'push', 'in_app']).default('email'),
  event: z.string().trim().max(60).optional(),
  subject: z.string().trim().max(255).optional(),
  body: z.string().trim().min(1, 'বার্তা লিখুন।').max(5000),
  isActive: z.boolean().optional(),
});

router.get(
  '/templates',
  asyncHandler(async (_req, res) => {
    const rows = await db.select().from(notificationTemplates).orderBy(notificationTemplates.name);
    return res.json({ success: true, templates: rows, data: rows });
  })
);

router.post(
  '/templates',
  requirePermission('notifications:write'),
  validateBody(templateSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof templateSchema>;
    const [clash] = await db.select({ id: notificationTemplates.id }).from(notificationTemplates).where(eq(notificationTemplates.name, input.name)).limit(1);
    if (clash) throw new AppError('এই নামে একটি টেমপ্লেট আছে।', 409);
    const [created] = await db.insert(notificationTemplates).values({ ...input, isActive: input.isActive ?? true }).returning();
    return res.status(201).json({ success: true, message: 'টেমপ্লেট তৈরি হয়েছে।', data: created });
  })
);

router.put(
  '/templates/:id',
  requirePermission('notifications:write'),
  validateBody(templateSchema.partial()),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(notificationTemplates).where(eq(notificationTemplates.id, id)).limit(1);
    if (!existing) throw new AppError('টেমপ্লেট পাওয়া যায়নি।', 404);
    const input = req.body as Partial<z.infer<typeof templateSchema>>;
    const [updated] = await db
      .update(notificationTemplates)
      .set({
        name: input.name ?? existing.name,
        channel: input.channel ?? existing.channel,
        event: input.event ?? existing.event,
        subject: input.subject ?? existing.subject,
        body: input.body ?? existing.body,
        isActive: input.isActive ?? existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(notificationTemplates.id, id))
      .returning();
    return res.json({ success: true, message: 'টেমপ্লেট আপডেট হয়েছে।', data: updated });
  })
);

router.delete(
  '/templates/:id',
  requirePermission('notifications:write'),
  asyncHandler(async (req, res) => {
    await db.delete(notificationTemplates).where(eq(notificationTemplates.id, Number(req.params.id)));
    return res.json({ success: true, message: 'টেমপ্লেট মুছে ফেলা হয়েছে।' });
  })
);

/** Recipient directory for the composer (id, name, masked contacts). */
router.get(
  '/recipients',
  asyncHandler(async (_req, res) => {
    const { users } = await import('../schemas/index');
    const rows = await db.select({ id: users.id, name: users.name, phone: users.phone, email: users.email }).from(users).where(eq(users.isActive, true)).limit(500);
    const data = rows.map((r) => ({ id: r.id, name: r.name, phone: r.phone, email: r.email }));
    return res.json({ success: true, recipients: data, data });
  })
);

export default router;
