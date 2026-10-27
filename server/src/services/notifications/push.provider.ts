import webpush from 'web-push';
import { env } from '../../config/env';
import { NotificationProvider, NotificationMessage, ProviderResult, ProviderNotConfiguredError } from './types';

/**
 * Web push (VAPID). Requires a stored browser subscription; the message `to`
 * field carries the JSON subscription for that device.
 */
export class PushNotificationProvider implements NotificationProvider {
  readonly channel = 'push' as const;
  readonly name = 'Web Push (VAPID)';

  isConfigured(): boolean {
    const ok = Boolean(env.PUSH_PUBLIC_KEY && env.PUSH_PRIVATE_KEY);
    if (ok) {
      try {
        webpush.setVapidDetails('mailto:support@nijerbazaar.com', env.PUSH_PUBLIC_KEY, env.PUSH_PRIVATE_KEY);
      } catch {
        return false;
      }
    }
    return ok;
  }

  configurationHint(): string {
    return 'Set PUSH_PUBLIC_KEY and PUSH_PRIVATE_KEY (generate with `npx web-push generate-vapid-keys`).';
  }

  async send(message: NotificationMessage): Promise<ProviderResult> {
    if (!this.isConfigured()) throw new ProviderNotConfiguredError('push', this.configurationHint());
    const subscription = JSON.parse(message.to);
    const res = await webpush.sendNotification(
      subscription,
      JSON.stringify({ title: message.subject ?? 'Nijer Bazaar', body: message.body })
    );
    return { providerMessageId: String(res.statusCode), status: 'sent' };
  }
}
