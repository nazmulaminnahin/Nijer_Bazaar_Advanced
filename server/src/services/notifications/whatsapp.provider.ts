import { env } from '../../config/env';
import { NotificationProvider, NotificationMessage, ProviderResult, ProviderNotConfiguredError } from './types';

/** WhatsApp Business Cloud API (Meta) text messages. */
export class WhatsAppNotificationProvider implements NotificationProvider {
  readonly channel = 'whatsapp' as const;
  readonly name = 'WhatsApp Cloud API';

  isConfigured(): boolean {
    return Boolean(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_ID);
  }

  configurationHint(): string {
    return 'Set WHATSAPP_TOKEN and WHATSAPP_PHONE_ID (Meta WhatsApp Business Cloud API).';
  }

  async send(message: NotificationMessage): Promise<ProviderResult> {
    if (!this.isConfigured()) throw new ProviderNotConfiguredError('whatsapp', this.configurationHint());
    const to = message.to.replace(/\D/g, '').replace(/^0/, '880');
    const res = await fetch(`https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.WHATSAPP_TOKEN}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message.body },
      }),
    });
    const data = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) throw new Error(`WhatsApp API error ${res.status}: ${data?.error?.message ?? 'unknown'}`);
    return { providerMessageId: data?.messages?.[0]?.id, status: 'sent' };
  }
}
