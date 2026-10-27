import { and, eq, inArray, gte, sql } from 'drizzle-orm';
import { db } from '../config/db';
import { notificationLogs, notificationTemplates, notifications, orders, users } from '../schemas/index';
import { AppError } from '../middleware/errorHandler';
import { EmailNotificationProvider } from './notifications/email.provider';
import { SmsNotificationProvider } from './notifications/sms.provider';
import { WhatsAppNotificationProvider } from './notifications/whatsapp.provider';
import { PushNotificationProvider } from './notifications/push.provider';
import { Channel, NotificationMessage, NotificationProvider } from './notifications/types';
import { randomCode } from '../utils/helpers';

const providers: Record<string, NotificationProvider> = {
  email: new EmailNotificationProvider(),
  sms: new SmsNotificationProvider(),
  whatsapp: new WhatsAppNotificationProvider(),
  push: new PushNotificationProvider(),
};

export function getProvider(channel: Channel): NotificationProvider | undefined {
  return providers[channel];
}

export function providerStatus() {
  return Object.values(providers).map((p) => ({
    channel: p.channel,
    name: p.name,
    configured: p.isConfigured(),
    hint: p.isConfigured() ? null : p.configurationHint(),
  }));
}

export type RecipientGroup = 'all' | 'customers' | 'recent_buyers';

export interface SendOptions {
  channels: Channel[];
  subject?: string;
  body: string;
  userIds?: number[];
  group?: RecipientGroup;
  meta?: Record<string, unknown>;
  createdBy?: number | null;
}

interface ResolvedRecipient {
  userId: number | null;
  email?: string | null;
  phone?: string | null;
}

async function resolveRecipients(options: SendOptions): Promise<ResolvedRecipient[]> {
  if (options.userIds?.length) {
    const rows = await db
      .select({ id: users.id, email: users.email, phone: users.phone })
      .from(users)
      .where(and(inArray(users.id, options.userIds), eq(users.isActive, true)));
    return rows.map((r) => ({ userId: r.id, email: r.email, phone: r.phone }));
  }

  if (options.group === 'customers' || options.group === 'all') {
    const rows = await db
      .select({ id: users.id, email: users.email, phone: users.phone })
      .from(users)
      .where(eq(users.isActive, true));
    return rows.map((r) => ({ userId: r.id, email: r.email, phone: r.phone }));
  }

  if (options.group === 'recent_buyers') {
    const since = new Date(Date.now() - 90 * 86_400_000);
    const rows = await db
      .selectDistinct({ id: users.id, email: users.email, phone: users.phone })
      .from(users)
      .innerJoin(orders, eq(orders.userId, users.id))
      .where(and(eq(users.isActive, true), gte(orders.createdAt, since)));
    return rows.map((r) => ({ userId: r.id, email: r.email, phone: r.phone }));
  }

  return [];
}

function recipientAddress(recipient: ResolvedRecipient, channel: Channel): string | null {
  if (channel === 'email') return recipient.email ?? null;
  if (channel === 'sms' || channel === 'whatsapp') return recipient.phone ?? null;
  return null;
}

/**
 * Orchestrates multi-channel delivery.
 * Every attempt is persisted (queued → sent/failed) so the admin UI can show
 * true delivery state per recipient instead of a single "OK" from the browser.
 */
export async function sendNotification(options: SendOptions) {
  if (!options.body?.trim()) throw new AppError('Message body is required.', 400);
  const channels = (options.channels ?? []).filter((c): c is Channel => ['email', 'sms', 'whatsapp', 'push'].includes(c));
  if (!channels.length) throw new AppError('Select at least one channel.', 400);

  const recipients = await resolveRecipients(options);
  if (!recipients.length) throw new AppError('No recipients matched the selection.', 400);

  const batchId = `BATCH-${randomCode(8)}`;
  const summary = { batchId, queued: 0, sent: 0, failed: 0, skipped: 0, results: [] as any[] };

  for (const channel of channels) {
    const provider = getProvider(channel);
    const configured = provider?.isConfigured() ?? false;

    for (const recipient of recipients) {
      const address = recipientAddress(recipient, channel);
      if (!address) {
        summary.skipped += 1;
        continue;
      }

      const [log] = await db
        .insert(notificationLogs)
        .values({
          channel,
          provider: provider?.name ?? 'unconfigured',
          recipient: address,
          userId: recipient.userId,
          subject: options.subject ?? null,
          body: options.body,
          status: 'queued',
          batchId,
          meta: options.meta ?? null,
        })
        .returning();

      if (!configured) {
        await db
          .update(notificationLogs)
          .set({ status: 'failed', lastError: `Provider not configured: ${provider?.configurationHint() ?? channel}` })
          .where(eq(notificationLogs.id, log.id));
        summary.failed += 1;
        summary.results.push({ id: log.id, channel, recipient: address, status: 'failed', error: 'provider_not_configured' });
        continue;
      }

      summary.queued += 1;
      const result = await deliverWithRetry(log.id, channel, {
        to: address,
        subject: options.subject,
        body: options.body,
        meta: options.meta,
      }, 2);
      if (result.status === 'sent') summary.sent += 1;
      else summary.failed += 1;
      summary.results.push({ id: log.id, channel, recipient: address, status: result.status, error: result.error });
    }
  }

  return summary;
}

export async function deliverWithRetry(
  logId: number,
  channel: Channel,
  message: NotificationMessage,
  retries = 2
): Promise<{ status: 'sent' | 'failed'; error?: string }> {
  const provider = getProvider(channel);
  let lastError = '';
  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    try {
      const result = await provider!.send(message);
      await db
        .update(notificationLogs)
        .set({
          status: result.status === 'queued' ? 'queued' : 'sent',
          attempts: attempt,
          providerMessageId: result.providerMessageId ?? null,
          sentAt: new Date(),
          lastError: null,
        })
        .where(eq(notificationLogs.id, logId));
      return { status: 'sent' };
    } catch (err) {
      lastError = (err as Error).message;
      await db
        .update(notificationLogs)
        .set({ attempts: attempt, lastError, status: 'failed' })
        .where(eq(notificationLogs.id, logId));
      if (attempt <= retries) await new Promise((r) => setTimeout(r, 200 * attempt));
    }
  }
  return { status: 'failed', error: lastError };
}

/** Re-sends a failed log entry. */
export async function retryNotification(logId: number) {
  const [log] = await db.select().from(notificationLogs).where(eq(notificationLogs.id, logId)).limit(1);
  if (!log) throw new AppError('Notification not found.', 404);
  if (log.status === 'sent' || log.status === 'delivered') throw new AppError('This message was already sent.', 400);
  const result = await deliverWithRetry(log.id, log.channel as Channel, {
    to: log.recipient,
    subject: log.subject ?? undefined,
    body: log.body ?? '',
  }, 1);
  return { id: log.id, ...result };
}

/** In-app notification for a single customer. */
export async function pushInAppNotification(input: {
  userId: number;
  title: string;
  message: string;
  type?: string;
  data?: Record<string, unknown>;
}) {
  await db.insert(notifications).values({
    userId: input.userId,
    title: input.title,
    message: input.message,
    type: input.type ?? 'info',
    data: input.data ? JSON.stringify(input.data) : null,
  });
}

/** Renders a stored template with {{placeholders}}. */
export async function renderTemplate(name: string, variables: Record<string, string | number>) {
  const [tpl] = await db.select().from(notificationTemplates).where(eq(notificationTemplates.name, name)).limit(1);
  if (!tpl) return null;
  const body = tpl.body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key) => String(variables[key] ?? ''));
  const subject = (tpl.subject ?? '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key) => String(variables[key] ?? ''));
  return { template: tpl, subject, body };
}

/**
 * Business-event hook. Currently records an in-app notification and logs
 * outbound attempts only for channels that the admin enabled.
 */
export async function notifyOrderEvent(orderId: number, event: 'placed' | 'status_changed', extra: Record<string, unknown> = {}) {
  try {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return;

    const statusBn: Record<string, string> = {
      pending: 'গৃহীত', confirmed: 'নিশ্চিত', processing: 'প্রস্তুত হচ্ছে',
      shipped: 'পাঠানো হয়েছে', delivered: 'ডেলিভারি সম্পন্ন', cancelled: 'বাতিল', returned: 'ফেরত',
    };
    const title = event === 'placed' ? 'অর্ডার গ্রহণ করা হয়েছে' : 'অর্ডার স্ট্যাটাস আপডেট';
    const message =
      event === 'placed'
        ? `আপনার অর্ডার ${order.orderNumber} গ্রহণ করা হয়েছে। মোট ৳${Number(order.total).toLocaleString()}.`
        : `আপনার অর্ডার ${order.orderNumber} এর বর্তমান অবস্থা: ${statusBn[order.status] ?? order.status}.`;

    if (order.userId) await pushInAppNotification({ userId: order.userId, title, message, type: 'order', data: { orderId } });
  } catch (err) {
    console.error('notifyOrderEvent failed:', (err as Error).message);
  }
}

export async function notificationStats() {
  const rows = await db
    .select({ channel: notificationLogs.channel, status: notificationLogs.status, count: sql<number>`count(*)` })
    .from(notificationLogs)
    .groupBy(notificationLogs.channel, notificationLogs.status);
  return rows.map((r) => ({ channel: r.channel, status: r.status, count: Number(r.count) }));
}
