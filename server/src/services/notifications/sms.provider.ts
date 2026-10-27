import { env } from '../../config/env';
import { NotificationProvider, NotificationMessage, ProviderResult, ProviderNotConfiguredError } from './types';

/**
 * Generic HTTP SMS gateway adapter (works with Bangladeshi bulk-SMS gateways
 * that accept JSON POSTs). Endpoint is configured with SMS_API_URL; when it is
 * absent the adapter reports itself as not configured instead of pretending.
 */
export class SmsNotificationProvider implements NotificationProvider {
  readonly channel = 'sms' as const;
  readonly name = env.SMS_PROVIDER || 'HTTP SMS gateway';
  private endpoint = process.env.SMS_API_URL || '';

  isConfigured(): boolean {
    return Boolean(this.endpoint && env.SMS_API_KEY);
  }

  configurationHint(): string {
    return 'Set SMS_API_URL, SMS_API_KEY and SMS_SENDER_ID in the server environment.';
  }

  async send(message: NotificationMessage): Promise<ProviderResult> {
    if (!this.isConfigured()) throw new ProviderNotConfiguredError('sms', this.configurationHint());
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.SMS_API_KEY}` },
      body: JSON.stringify({ to: message.to, from: env.SMS_SENDER_ID, text: message.body }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`SMS gateway responded ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { providerMessageId: String(data.id ?? data.message_id ?? ''), status: 'sent' };
  }
}
