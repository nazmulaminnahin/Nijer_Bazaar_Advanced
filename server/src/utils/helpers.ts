import crypto from 'crypto';

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizePhone(input?: string | null): string {
  const digits = String(input ?? '').replace(/\D/g, '');
  if (!digits) return '';
  // Bangladesh: 8801XXXXXXXXX / 01XXXXXXXXX → keep last 11 digits
  if (digits.startsWith('880') && digits.length > 11) return `0${digits.slice(3, 13)}`;
  return digits.slice(-11);
}

export function isValidBdPhone(input?: string | null): boolean {
  const phone = normalizePhone(input);
  return /^01[3-9]\d{8}$/.test(phone);
}

export function isValidEmail(input?: string | null): boolean {
  if (!input) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(input).trim());
}

export function money(value: number | string | null | undefined): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function taka(value: number | string | null | undefined): string {
  const n = money(value);
  return `৳${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Deterministic, human-friendly order number: NB-YYMMDD-XXXX */
export function generateOrderNumber(seq: number, date = new Date()): string {
  const y = String(date.getFullYear()).slice(2);
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `NB-${y}${m}${d}-${String(seq).padStart(4, '0')}`;
}

export function generateInvoiceNumber(seq: number): string {
  return `INV-${10_000 + seq}`;
}

export function randomCode(length = 10, alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function generateGiftCardCode(): string {
  return `NBGC-${randomCode(4)}-${randomCode(4)}-${randomCode(4)}`;
}

export function generateCouponCode(prefix = 'NB'): string {
  return `${prefix}${randomCode(6)}`;
}

export function dateOnly(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toISOString().slice(0, 10);
}

export function startOfDay(value = new Date()): Date {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(value = new Date()): Date {
  const d = new Date(value);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function paginate(query: Record<string, unknown>, defaultLimit = 20) {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1);
  const rawLimit = parseInt(String(query.limit ?? defaultLimit), 10) || defaultLimit;
  const limit = Math.min(200, Math.max(1, rawLimit));
  return { page, limit, offset: (page - 1) * limit };
}

export function parseBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'on'].includes(String(value ?? '').toLowerCase());
}
