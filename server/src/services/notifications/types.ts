export type Channel = 'email' | 'sms' | 'whatsapp' | 'push' | 'in_app';

export interface NotificationMessage {
  to: string;
  subject?: string;
  body: string;
  meta?: Record<string, unknown>;
}

export interface ProviderResult {
  providerMessageId?: string;
  status: 'sent' | 'queued';
}

export interface NotificationProvider {
  readonly channel: Channel;
  readonly name: string;
  /** Credentials present AND the last configuration test passed. */
  isConfigured(): boolean;
  /** Why the provider cannot send, for the admin UI. */
  configurationHint(): string;
  send(message: NotificationMessage): Promise<ProviderResult>;
}

export class ProviderNotConfiguredError extends Error {
  readonly code = 'PROVIDER_NOT_CONFIGURED';
  constructor(channel: Channel, hint: string) {
    super(`${channel} provider is not configured. ${hint}`);
  }
}
