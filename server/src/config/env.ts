import dotenv from 'dotenv';
dotenv.config();

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

const isProd = (process.env.NODE_ENV || 'development') === 'production';

/**
 * Secrets must be provided in production. In development we fall back to a
 * generated, per-process value (never a shipped default) and warn loudly.
 */
function secret(name: string, devFallbackLabel: string): string {
  const value = process.env[name];
  if (value && value.length >= 16) return value;
  if (isProd) {
    throw new Error(`${name} must be set to a random value of at least 16 characters in production.`);
  }
  // eslint-disable-next-line no-console
  console.warn(`⚠️  ${name} is not set — using an ephemeral development ${devFallbackLabel}. Sessions reset on restart.`);
  return `${devFallbackLabel}-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export const env = {
  PORT: process.env.PORT || '5000',
  NODE_ENV: process.env.NODE_ENV || 'development',
  isProd,

  // Database — DB_DRIVER=postgres (default) or pglite (embedded, for dev/tests)
  DB_DRIVER: (process.env.DB_DRIVER || 'postgres') as 'postgres' | 'pglite',
  DATABASE_URL: process.env.DATABASE_URL || '',
  PGLITE_DIR: process.env.PGLITE_DIR || './.pglite',
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '5432', 10),
  DB_NAME: process.env.DB_NAME || 'nijer_bazaar',
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_SSL: bool(process.env.DB_SSL, false),

  JWT_SECRET: secret('JWT_SECRET', 'dev-customer-secret'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  JWT_ADMIN_SECRET: secret('JWT_ADMIN_SECRET', 'dev-admin-secret'),
  JWT_ADMIN_EXPIRES_IN: process.env.JWT_ADMIN_EXPIRES_IN || '1d',

  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  CORS_ORIGINS: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // Uploads
  UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || String(5 * 1024 * 1024), 10),
  UPLOAD_PUBLIC_PREFIX: process.env.UPLOAD_PUBLIC_PREFIX || '/uploads',

  // Email / SMS / WhatsApp / push providers
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_SECURE: bool(process.env.SMTP_SECURE, false),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  MAIL_FROM: process.env.MAIL_FROM || 'Nijer Bazaar <no-reply@nijerbazaar.com>',

  SMS_PROVIDER: process.env.SMS_PROVIDER || '',
  SMS_API_KEY: process.env.SMS_API_KEY || '',
  SMS_SENDER_ID: process.env.SMS_SENDER_ID || '',

  WHATSAPP_PROVIDER: process.env.WHATSAPP_PROVIDER || '',
  WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN || '',
  WHATSAPP_PHONE_ID: process.env.WHATSAPP_PHONE_ID || '',

  PUSH_PUBLIC_KEY: process.env.PUSH_PUBLIC_KEY || '',
  PUSH_PRIVATE_KEY: process.env.PUSH_PRIVATE_KEY || '',

  // Seed (never commit real credentials)
  SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL || 'admin@nijerbazaar.com',
  SEED_ADMIN_PHONE: process.env.SEED_ADMIN_PHONE || '01700000000',
  SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD || '',
};

export const isConfigured = {
  email: Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS),
  sms: Boolean(env.SMS_PROVIDER && env.SMS_API_KEY),
  whatsapp: Boolean(env.WHATSAPP_PROVIDER && env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_ID),
  push: Boolean(env.PUSH_PUBLIC_KEY && env.PUSH_PRIVATE_KEY),
};
