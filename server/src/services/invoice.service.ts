import { eq } from 'drizzle-orm';
import { db } from '../config/db';
import { orderItems, orders } from '../schemas/index';
import { getSettings, toNumber } from './settings.service';
import { AppError } from '../middleware/errorHandler';

/**
 * Builds `invoice-no_customer-name_phone-number_date.pdf`
 * Example: INV-10025_Rahim-Ahmed_01712345678_2026-10-25.pdf
 * Unicode is transliterated/stripped so the name is safe on every filesystem.
 */
export function buildInvoiceFilename(input: {
  invoiceNumber: string;
  customerName: string;
  phone: string;
  date: string | Date;
}): string {
  const safe = (value: string, fallback: string) => {
    const cleaned = String(value ?? '')
      .normalize('NFKD')
      // keep latin letters, digits; convert separators to single dash
      .replace(/[^\x20-\x7E]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    return cleaned || fallback;
  };
  const invoiceNo = safe(input.invoiceNumber, 'invoice').toUpperCase();
  const name = safe(input.customerName, 'customer');
  const phone = String(input.phone ?? '').replace(/\D/g, '') || 'no-phone';
  const rawDate = typeof input.date === 'string' ? input.date : input.date.toISOString();
  const date = /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? rawDate.slice(0, 10) : new Date(rawDate).toISOString().slice(0, 10);
  return `${invoiceNo}_${name}_${phone}_${date}.pdf`;
}

const STATUS_LABEL_BN: Record<string, string> = {
  pending: 'পেন্ডিং', confirmed: 'কনফার্মড', processing: 'প্রসেসিং',
  shipped: 'শিপড', delivered: 'ডেলিভার্ড', cancelled: 'বাতিল', returned: 'রিটার্ন',
};

export async function getInvoiceData(orderId: number) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new AppError('Order not found.', 404);
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const settings = await getSettings();
  const subtotal = Number(order.subtotal);
  const discount = Number(order.discount);
  const shipping = Number(order.shippingCost);

  return {
    invoiceNumber: order.invoiceNumber,
    orderNumber: order.orderNumber,
    date: order.createdAt.toISOString(),
    dateOnly: order.createdAt.toISOString().slice(0, 10),
    status: order.status,
    statusBn: STATUS_LABEL_BN[order.status] ?? order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    customer: order.shippingAddress,
    items: items.map((i) => ({
      id: i.id,
      name: i.productName,
      sku: i.productSku,
      image: i.productImage,
      quantity: i.quantity,
      price: Number(i.price),
      lineTotal: Math.round(Number(i.price) * i.quantity),
      variant: i.variant,
    })),
    totals: {
      subtotal,
      discount,
      shipping,
      total: Number(order.total),
      // amount due now for COD, 0 when already paid online
      dueNow: order.paymentStatus === 'paid' ? 0 : Number(order.total),
    },
    brand: {
      name: settings.site_name,
      nameBn: settings.site_name_bn,
      logo: settings.logo_url,
      phone: settings.contact_phone,
      email: settings.contact_email,
      address: settings.contact_address,
      note: settings.invoice_footer_note,
      currency: settings.currency_symbol || '৳',
      freeShippingThreshold: toNumber(settings.free_shipping_threshold, 999),
    },
    filename: buildInvoiceFilename({
      invoiceNumber: order.invoiceNumber,
      customerName: order.shippingAddress?.name ?? 'customer',
      phone: order.shippingAddress?.phone ?? '',
      date: order.createdAt,
    }),
  };
}

/** Standalone printable invoice HTML (works without the SPA). */
export async function renderInvoiceHtml(orderId: number): Promise<string> {
  const data = await getInvoiceData(orderId);
  const esc = (v: unknown) =>
    String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
  const taka = (n: number) => `${data.brand.currency}${n.toLocaleString('en-US')}`;

  return `<!doctype html>
<html lang="bn"><head><meta charset="utf-8" />
<title>${esc(data.invoiceNumber)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Noto Sans Bengali', 'Hind Siliguri', system-ui, -apple-system, Segoe UI, sans-serif; color:#111827; margin:0; padding:24px; font-size:13px; }
  .head { display:flex; justify-content:space-between; gap:24px; border-bottom:2px solid #f97316; padding-bottom:16px; }
  .brand { display:flex; gap:12px; align-items:center; }
  .brand img { height:52px; width:auto; max-width:190px; object-fit:contain; }
  .brand h1 { font-size:20px; margin:0; }
  .brand p { margin:2px 0; color:#6b7280; font-size:12px; }
  .meta { text-align:right; }
  .meta h2 { margin:0 0 4px; font-size:18px; letter-spacing:.5px; }
  .pill { display:inline-block; padding:3px 10px; border-radius:999px; background:#fff7ed; color:#c2410c; font-weight:600; font-size:11px; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin:20px 0; }
  .card { border:1px solid #e5e7eb; border-radius:10px; padding:12px 14px; }
  .card h3 { margin:0 0 8px; font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:#6b7280; }
  table { width:100%; border-collapse:collapse; margin-top:8px; }
  th, td { text-align:left; padding:9px 8px; border-bottom:1px solid #eef2f7; vertical-align:top; }
  th { font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:#6b7280; background:#fafafa; }
  td.num, th.num { text-align:right; white-space:nowrap; }
  .totals { margin-left:auto; width:320px; margin-top:14px; }
  .totals div { display:flex; justify-content:space-between; padding:6px 0; }
  .totals .grand { border-top:2px solid #111827; margin-top:6px; padding-top:10px; font-weight:700; font-size:15px; }
  footer { margin-top:28px; border-top:1px dashed #d1d5db; padding-top:10px; color:#6b7280; font-size:11px; display:flex; justify-content:space-between; gap:16px; }
  @media print { body { padding:0 } .no-print { display:none } }
</style></head>
<body>
  <div class="head">
    <div class="brand">
      ${data.brand.logo ? `<img src="${esc(data.brand.logo)}" alt="logo" />` : ''}
      <div>
        <h1>${esc(data.brand.nameBn || data.brand.name)}</h1>
        <p>${esc(data.brand.address)}</p>
        <p>${esc(data.brand.phone)} · ${esc(data.brand.email)}</p>
      </div>
    </div>
    <div class="meta">
      <h2>INVOICE</h2>
      <p><strong>${esc(data.invoiceNumber)}</strong></p>
      <p>অর্ডার: ${esc(data.orderNumber)}</p>
      <p>তারিখ: ${esc(data.dateOnly)}</p>
      <span class="pill">${esc(data.statusBn)}</span>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <h3>গ্রাহকের তথ্য</h3>
      <p><strong>${esc(data.customer?.name)}</strong></p>
      <p>${esc(data.customer?.phone)}</p>
      <p>${esc(data.customer?.address)}</p>
      <p>${esc([data.customer?.thana, data.customer?.district, data.customer?.division].filter(Boolean).join(', '))}</p>
      ${data.customer?.postalCode ? `<p>পোস্ট কোড: ${esc(data.customer.postalCode)}</p>` : ''}
    </div>
    <div class="card">
      <h3>পেমেন্ট</h3>
      <p>পদ্ধতি: ${esc(data.paymentMethod.toUpperCase())}</p>
      <p>স্ট্যাটাস: ${esc(data.paymentStatus)}</p>
      <p>পরিশোধযোগ্য: <strong>${taka(data.totals.dueNow)}</strong></p>
    </div>
  </div>

  <table>
    <thead><tr><th>পণ্য</th><th class="num">পরিমাণ</th><th class="num">একক দাম</th><th class="num">মোট</th></tr></thead>
    <tbody>
      ${data.items.map((i) => `<tr>
        <td>${esc(i.name)}${i.sku ? `<div style="color:#9ca3af;font-size:11px">SKU: ${esc(i.sku)}</div>` : ''}</td>
        <td class="num">${i.quantity}</td>
        <td class="num">${taka(i.price)}</td>
        <td class="num">${taka(i.lineTotal)}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <div class="totals">
    <div><span>সাবটোটাল</span><span>${taka(data.totals.subtotal)}</span></div>
    <div><span>ডিসকাউন্ট</span><span>-${taka(data.totals.discount)}</span></div>
    <div><span>ডেলিভারি চার্জ</span><span>${taka(data.totals.shipping)}</span></div>
    <div class="grand"><span>সর্বমোট</span><span>${taka(data.totals.total)}</span></div>
  </div>

  <footer>
    <span>${esc(data.brand.note)}</span>
    <span>Made by Engr. Nazmul Amin</span>
  </footer>
</body></html>`;
}
