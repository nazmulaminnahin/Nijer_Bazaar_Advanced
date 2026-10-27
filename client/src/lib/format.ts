export const taka = (value: number | string | null | undefined): string => {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '৳0';
  return `৳${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
};

export const number = (value: number | string | null | undefined): string =>
  Number(value ?? 0).toLocaleString('en-US');

export const dateOnly = (value?: string | Date | null): string => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const dateTime = (value?: string | Date | null): string => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
};

export const isoDate = (value?: string | Date | null): string =>
  value ? new Date(value).toISOString().slice(0, 10) : '';

export const today = (): string => new Date().toISOString().slice(0, 10);

export const maskPhone = (phone?: string | null): string => {
  if (!phone) return '—';
  return phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2');
};

export const ORDER_STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: 'পেন্ডিং', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  confirmed: { label: 'কনফার্মড', className: 'bg-sky-50 text-sky-700 ring-sky-200' },
  processing: { label: 'প্রসেসিং', className: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  shipped: { label: 'শিপড', className: 'bg-violet-50 text-violet-700 ring-violet-200' },
  delivered: { label: 'ডেলিভার্ড', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  cancelled: { label: 'বাতিল', className: 'bg-red-50 text-red-700 ring-red-200' },
  returned: { label: 'রিটার্ন', className: 'bg-gray-100 text-gray-700 ring-gray-200' },
};

export const PAYMENT_STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: 'বাকি', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  paid: { label: 'পরিশোধিত', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  failed: { label: 'ব্যর্থ', className: 'bg-red-50 text-red-700 ring-red-200' },
  refunded: { label: 'ফেরত', className: 'bg-gray-100 text-gray-700 ring-gray-200' },
};

export const PAYMENT_METHOD: Record<string, string> = {
  cod: 'ক্যাশ অন ডেলিভারি', bkash: 'বিকাশ', nagad: 'নগদ', card: 'কার্ড', bank: 'ব্যাংক',
};

export const slugToTitle = (slug?: string | null): string =>
  (slug ?? '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// Convenience aliases used across pages.
export const formatDate = dateTime;

export const orderStatusLabel = (status?: string | null): string =>
  ORDER_STATUS[status ?? '']?.label ?? status ?? '—';

export const orderStatusTone = (status?: string | null): 'gray' | 'brand' | 'green' | 'red' | 'blue' | 'amber' => {
  switch (status) {
    case 'pending': return 'amber';
    case 'confirmed':
    case 'processing': return 'blue';
    case 'shipped': return 'brand';
    case 'delivered': return 'green';
    case 'cancelled': return 'red';
    default: return 'gray';
  }
};

export const paymentStatusLabel = (status?: string | null): string =>
  PAYMENT_STATUS[status ?? '']?.label ?? status ?? '—';
