import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../../config/env';
import { NotificationProvider, NotificationMessage, ProviderResult, ProviderNotConfiguredError } from './types';

export class EmailNotificationProvider implements NotificationProvider {
  readonly channel = 'email' as const;
  readonly name = 'SMTP';
  private transporter: Transporter | null = null;

  constructor() {
    if (this.isConfigured()) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      });
    }
  }

  isConfigured(): boolean {
    return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
  }

  configurationHint(): string {
    return 'Set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS in the server environment.';
  }

  async send(message: NotificationMessage): Promise<ProviderResult> {
    if (!this.transporter) throw new ProviderNotConfiguredError('email', this.configurationHint());
    const info = await this.transporter.sendMail({
      from: env.MAIL_FROM,
      to: message.to,
      subject: message.subject ?? 'Nijer Bazaar',
      text: message.body,
      html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6">${message.body.replace(/\n/g, '<br/>')}</div>`,
    });
    return { providerMessageId: info.messageId, status: 'sent' };
  }
}
