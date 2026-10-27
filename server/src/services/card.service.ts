import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { barcodeSvg } from './barcode.service';
import { env } from '../config/env';

/** Escapes text for safe SVG embedding. */
function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

/**
 * Embeds the brand logo into server-rendered SVG as a data URI so the output is
 * self-contained (and printable/downloadable offline). Uploaded logos resolve
 * from UPLOAD_DIR; bundled brand assets resolve from client/public.
 */
function resolveLogoPath(logoUrl: string): string | null {
  if (/^https?:\/\//i.test(logoUrl) || logoUrl.startsWith('data:')) return null;
  const clean = logoUrl.split('?')[0];
  if (clean.startsWith(`${env.UPLOAD_PUBLIC_PREFIX}/`)) {
    const root = path.isAbsolute(env.UPLOAD_DIR) ? env.UPLOAD_DIR : path.join(process.cwd(), env.UPLOAD_DIR);
    return path.join(root, clean.slice(env.UPLOAD_PUBLIC_PREFIX.length + 1));
  }
  if (clean.startsWith('/')) {
    const candidate = path.join(process.cwd(), '../client/public', clean);
    if (fs.existsSync(candidate)) return candidate;
    const packaged = path.join(process.cwd(), 'public', clean);
    if (fs.existsSync(packaged)) return packaged;
  }
  return null;
}

function logoHref(logoUrl: string | undefined): string | null {
  if (!logoUrl) return null;
  if (logoUrl.startsWith('data:')) return logoUrl;
  const file = resolveLogoPath(logoUrl);
  if (!file) return /^https?:/i.test(logoUrl) ? logoUrl : null;
  try {
    const ext = path.extname(file).toLowerCase().replace('.', '') || 'png';
    const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
  } catch {
    return null;
  }
}

function logoMarkup(logoUrl: string | undefined, x: number, y: number, height: number): string {
  const href = logoHref(logoUrl);
  if (!href) return '';
  return `<image href="${esc(href)}" x="${x}" y="${y}" height="${height}" preserveAspectRatio="xMinYMid meet" />`;
}

export interface GiftCardDesignInput {
  code: string;
  amount: number;
  initialAmount: number;
  expiresAt: string | null;
  brand: { name: string; nameBn?: string; logo?: string; currency?: string };
  design?: string;
  terms?: string;
}

const DESIGNS: Record<string, { top: string; bottom: string; accent: string }> = {
  classic: { top: '#5b5b57', bottom: '#3f3f3c', accent: '#ef4444' },
  festival: { top: '#b91c1c', bottom: '#7f1d1d', accent: '#fbbf24' },
  premium: { top: '#1e293b', bottom: '#0f172a', accent: '#f59e0b' },
  eid: { top: '#065f46', bottom: '#064e3b', accent: '#fde68a' },
};

/** Front side of the gift card (matches the attached sample layout). */
export function renderGiftCardFront(input: GiftCardDesignInput): string {
  const palette = DESIGNS[input.design ?? 'classic'] ?? DESIGNS.classic;
  const currency = input.brand.currency ?? '৳';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1012" height="638" viewBox="0 0 1012 638">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette.top}"/>
      <stop offset="100%" stop-color="${palette.bottom}"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="6" stdDeviation="9" flood-opacity="0.25"/>
    </filter>
  </defs>
  <rect width="1012" height="638" fill="#f5f5f4"/>
  <rect x="40" y="40" width="932" height="558" rx="26" fill="url(#g)" filter="url(#shadow)"/>
  <circle cx="880" cy="120" r="150" fill="#ffffff" opacity="0.05"/>
  <circle cx="140" cy="560" r="120" fill="#ffffff" opacity="0.04"/>
  <rect x="88" y="96" width="386" height="200" rx="16" fill="#111827"/>
  ${logoMarkup(input.brand.logo, 110, 118, 96)}
  <text x="110" y="248" font-family="Segoe UI, Noto Sans Bengali, sans-serif" font-size="38" font-weight="700" fill="#ffffff">${esc(input.brand.nameBn || input.brand.name)}</text>
  <text x="112" y="278" font-family="Segoe UI, sans-serif" font-size="15" letter-spacing="4" fill="${palette.accent}">GIFT CARD</text>
  <text x="88" y="470" font-family="Segoe UI, sans-serif" font-size="22" letter-spacing="3" fill="#d1d5db">GIFT CARD</text>
  <text x="86" y="540" font-family="Segoe UI, Noto Sans Bengali, sans-serif" font-size="62" font-weight="700" fill="#ffffff">${esc(currency)}${input.amount.toLocaleString('en-US')}</text>
  <text x="924" y="500" text-anchor="end" font-family="Segoe UI, sans-serif" font-size="18" fill="#e5e7eb">Code</text>
  <text x="924" y="530" text-anchor="end" font-family="Consolas, monospace" font-size="24" fill="#ffffff">${esc(input.code)}</text>
  <text x="924" y="562" text-anchor="end" font-family="Segoe UI, sans-serif" font-size="15" fill="#d1d5db">${input.expiresAt ? `Valid till ${esc(input.expiresAt)}` : 'No expiry'}</text>
</svg>`;
}

/** Back side: barcode + usage terms. */
export async function renderGiftCardBack(input: GiftCardDesignInput): Promise<string> {
  const palette = DESIGNS[input.design ?? 'classic'] ?? DESIGNS.classic;
  const barcode = await barcodeSvg(input.code, { scale: 2, height: 14 });
  const barcodeInner = barcode.replace(/^<\?xml[^>]*\?>/, '').replace(/<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const terms = input.terms ?? 'This card can be redeemed on nijerbazaar.com. Not refundable or exchangeable for cash.';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1012" height="638" viewBox="0 0 1012 638">
  <rect width="1012" height="638" fill="#f5f5f4"/>
  <rect x="40" y="40" width="932" height="558" rx="26" fill="#ffffff" stroke="#d6d3d1" stroke-width="2"/>
  <rect x="40" y="40" width="932" height="96" rx="26" fill="${palette.bottom}"/>
  <rect x="40" y="112" width="932" height="24" fill="${palette.bottom}"/>
  ${logoMarkup(input.brand.logo, 78, 58, 60)}
  <text x="260" y="102" font-family="Segoe UI, Noto Sans Bengali, sans-serif" font-size="30" font-weight="700" fill="#ffffff">${esc(input.brand.nameBn || input.brand.name)} — GIFT CARD</text>
  <text x="86" y="196" font-family="Segoe UI, sans-serif" font-size="17" letter-spacing="2" fill="#78716c">CARD NUMBER</text>
  <text x="86" y="238" font-family="Consolas, monospace" font-size="30" fill="#1c1917">${esc(input.code)}</text>
  <g transform="translate(240, 268)">${barcodeInner}</g>
  <text x="86" y="470" font-family="Segoe UI, Noto Sans Bengali, sans-serif" font-size="16" fill="#44403c">${esc(terms)}</text>
  <text x="86" y="500" font-family="Segoe UI, Noto Sans Bengali, sans-serif" font-size="16" fill="#44403c">Scan the barcode at checkout, or enter the card number above.</text>
  <text x="86" y="530" font-family="Segoe UI, sans-serif" font-size="15" fill="#78716c">Issued ${new Date().toISOString().slice(0, 10)} · Balance ${esc(input.brand.currency ?? '৳')}${input.amount.toLocaleString('en-US')}</text>
  <text x="924" y="556" text-anchor="end" font-family="Segoe UI, sans-serif" font-size="13" fill="#a8a29e">Nijer Bazaar · Made by Engr. Nazmul Amin</text>
</svg>`;
}

export interface CouponDesignInput {
  code: string;
  type: 'percentage' | 'flat' | 'free_shipping';
  value: number;
  minOrderAmount: number | null;
  expiresAt: string;
  brand: { name: string; nameBn?: string; logo?: string; currency?: string };
  terms?: string | null;
}

/**
 * Coupon artwork following the supplied sample: barcode on the left, brand and
 * "COUPON" on the right, SAVE box + value box, Bengali terms underneath.
 */
export async function renderCouponSvg(input: CouponDesignInput): Promise<string> {
  const currency = input.brand.currency ?? '৳';
  const barcode = await barcodeSvg(input.code, { scale: 2, height: 14 });
  const barcodeInner = barcode.replace(/^<\?xml[^>]*\?>/, '').replace(/<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const saveText =
    input.type === 'percentage' ? `SAVE upto ${input.value}%` : input.type === 'free_shipping' ? 'SAVE delivery' : `SAVE upto ${currency}${input.value}`;
  const minOrder = input.minOrderAmount ?? 0;
  const expires = input.expiresAt.slice(0, 10);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="640" viewBox="0 0 1200 640">
  <rect width="1200" height="640" fill="#f5f5f4"/>
  <g filter="url(#s)">
    <rect x="30" y="60" width="1140" height="520" rx="22" fill="#ffffff" stroke="#e7e5e4"/>
    <rect x="30" y="60" width="250" height="520" rx="22" fill="#ffffff"/>
    <rect x="258" y="60" width="912" height="520" rx="22" fill="#d81f26"/>
    <rect x="258" y="60" width="30" height="520" fill="#d81f26"/>
    <g transform="translate(60, 150)">${barcodeInner}</g>
  </g>
  <defs><filter id="s"><feDropShadow dx="0" dy="8" stdDeviation="12" flood-opacity="0.18"/></filter></defs>
  ${logoMarkup(input.brand.logo, 330, 96, 62)}
  <text x="330" y="212" font-family="Segoe UI, Noto Sans Bengali, sans-serif" font-size="34" font-weight="700" fill="#ffffff">${esc(input.brand.nameBn || input.brand.name)}</text>
  <text x="1090" y="130" text-anchor="end" font-family="Segoe UI, sans-serif" font-size="34" letter-spacing="4" font-weight="700" fill="#ffffff">COUPON</text>
  <text x="330" y="250" font-family="Consolas, monospace" font-size="24" letter-spacing="2" fill="#ffe4e6">${esc(input.code)}</text>
  <g>
    <rect x="330" y="286" width="420" height="120" rx="10" fill="none" stroke="#ffffff" stroke-width="4"/>
    <text x="540" y="368" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="58" font-weight="800" fill="#ffffff">SAVE</text>
    <rect x="772" y="286" width="290" height="120" rx="10" fill="#ffffff"/>
    <text x="917" y="366" text-anchor="middle" font-family="Segoe UI, Noto Sans Bengali, sans-serif" font-size="52" font-weight="800" fill="#d81f26">${input.type === 'percentage' ? `${input.value}%` : input.type === 'free_shipping' ? 'FREE' : `${currency}${input.value}`}</text>
  </g>
  <text x="330" y="440" font-family="Segoe UI, sans-serif" font-size="20" fill="#ffe4e6">${esc(saveText)}</text>
  <text x="330" y="492" font-family="Segoe UI, Noto Sans Bengali, sans-serif" font-size="21" fill="#ffffff">শর্তাবলী:</text>
  <text x="330" y="524" font-family="Segoe UI, Noto Sans Bengali, sans-serif" font-size="18" fill="#ffe4e6">১. সর্বনিম্ন অর্ডার: ${currency}${minOrder}</text>
  <text x="330" y="552" font-family="Segoe UI, Noto Sans Bengali, sans-serif" font-size="18" fill="#ffe4e6">২. মেয়াদ: ${esc(expires)}</text>
  <text x="330" y="576" font-family="Segoe UI, Noto Sans Bengali, sans-serif" font-size="14" fill="#fecdd3">${esc(input.terms ?? 'একটি অর্ডারে একবার ব্যবহারযোগ্য।')}</text>
</svg>`;
}

/** Rasterises an SVG card for downloads that need a bitmap. */
export async function svgToPng(svg: string, width?: number): Promise<Buffer> {
  const image = sharp(Buffer.from(svg));
  return width ? image.resize({ width }).png().toBuffer() : image.png().toBuffer();
}
