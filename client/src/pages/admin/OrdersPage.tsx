import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, Printer, Download, Eye, Pencil, Truck, RefreshCw, Filter, Phone, MapPin, X, FileText,
} from 'lucide-react';
import { adminApi, getApiErrorMessage } from '@/lib/api';
import { taka, number, dateTime, orderStatusLabel, orderStatusTone, PAYMENT_METHOD, paymentStatusLabel } from '@/lib/format';
import { useAdmin } from '@/store/admin';
import { toast } from '@/lib/toast';
import {
  Badge, Button, EmptyState, Input, Modal, Pagination, Select, Table, Tbody, Td, Th, Thead,
  Tabs, Toolbar, PageSpinner,
} from '@/components/admin/ui';
import { PageHeader } from '@/components/layout/AdminLayout';
import { cn } from '@/lib/utils';

interface OrderItem { id: number; productId: number; productName: string; quantity: number; price: number; lineTotal: number; productImage?: string | null; productSku?: string | null }
interface Order {
  id: number; orderNumber: string; invoiceNumber: string; status: string; paymentStatus: string;
  paymentMethod: string; subtotal: number; discount: number; shippingCost: number; total: number;
  customerName: string; customerPhone: string; createdAt: string; itemCount: number;
  shippingAddress: { name: string; phone: string; address: string; division: string; district: string; thana: string; note?: string };
  items: OrderItem[]; trackingNumber?: string | null; courierId?: number | null; notes?: string | null;
  statusHistory?: Array<{ id: number; status: string; note?: string | null; createdAt: string }>;
}

const STATUS_FLOW: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
};

const TABS = [
  { value: 'all', label: 'সব' },
  { value: 'pending', label: 'পেন্ডিং' },
  { value: 'confirmed', label: 'কনফার্মড' },
  { value: 'shipped', label: 'শিপড' },
  { value: 'delivered', label: 'ডেলিভার্ড' },
];

export default function OrdersPage() {
  const can = useAdmin((s) => s.can);
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'all';
  const search = params.get('search') ?? '';

  const [orders, setOrders] = useState<Order[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(search);
  const [from, setFrom] = useState(params.get('from') ?? '');
  const [to, setTo] = useState(params.get('to') ?? '');
  const [detail, setDetail] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusNote, setStatusNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editItems, setEditItems] = useState<Array<{ productId: number; quantity: number }>>([]);
  const [editReason, setEditReason] = useState('');
  const [couriers, setCouriers] = useState<Array<{ id: number; name: string }>>([]);
  const [courierId, setCourierId] = useState('');
  const [tracking, setTracking] = useState('');
  const [invoice, setInvoice] = useState<any>(null);

  const page = Number(params.get('page') ?? 1);

  const load = useCallback(() => {
    setLoading(true);
    const query = new URLSearchParams({ page: String(page), limit: '15' });
    if (status !== 'all') query.set('status', status);
    if (search) query.set('search', search);
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    adminApi
      .get(`/orders/admin/all?${query.toString()}`)
      .then((res) => {
        setOrders(res.data.orders ?? []);
        setCounts(res.data.counts ?? {});
        setPagination({
          page: res.data.pagination?.page ?? 1,
          totalPages: res.data.pagination?.totalPages ?? 1,
          total: res.data.pagination?.total ?? 0,
        });
      })
      .catch((err) => toast.error(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [page, status, search, from, to]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    adminApi.get('/admin/couriers').then((res) => setCouriers(res.data.couriers ?? [])).catch(() => undefined);
  }, []);

  const updateFilter = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  const openDetail = async (id: number) => {
    setDetailLoading(true);
    setInvoice(null);
    try {
      const res = await adminApi.get(`/orders/admin/${id}`);
      const o: Order = res.data.order;
      setDetail(o);
      setCourierId(o.courierId ? String(o.courierId) : '');
      setTracking(o.trackingNumber ?? '');
      setStatusNote('');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  };

  const changeStatus = async (next: string) => {
    if (!detail) return;
    setBusy(true);
    try {
      const res = await adminApi.put(`/orders/admin/${detail.id}/status`, { status: next, note: statusNote || undefined });
      toast.success(res.data.message ?? 'স্ট্যাটাস আপডেট হয়েছে');
      setDetail(res.data.order);
      setStatusNote('');
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const saveCourier = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      await adminApi.patch(`/orders/admin/${detail.id}/courier`, {
        courierId: courierId ? Number(courierId) : null,
        courierTrackingId: tracking || undefined,
      });
      toast.success('কুরিয়ার তথ্য সংরক্ষণ হয়েছে');
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const openEdit = () => {
    if (!detail) return;
    setEditItems(detail.items.map((i) => ({ productId: i.productId, quantity: i.quantity })));
    setEditReason('');
    setEditOpen(true);
  };

  const saveItems = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const res = await adminApi.put(`/orders/admin/${detail.id}/items`, {
        items: editItems.filter((i) => i.quantity > 0),
        reason: editReason || undefined,
        acknowledgePaidChange: detail.paymentStatus === 'paid' ? true : undefined,
      });
      toast.success(res.data.message ?? 'অর্ডার আপডেট হয়েছে');
      setDetail(res.data.order);
      setEditOpen(false);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const loadInvoice = async () => {
    if (!detail) return;
    try {
      const res = await adminApi.get(`/orders/admin/${detail.id}/invoice`);
      setInvoice(res.data.invoice);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const openPrint = async () => {
    if (!detail) return;
    try {
      const res = await adminApi.get(`/orders/admin/${detail.id}/invoice/print`, { responseType: 'text' });
      const win = window.open('', '_blank');
      if (win) { win.document.write(res.data); win.document.close(); }
      else toast.error('পপ-আপ ব্লক করা হয়েছে');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const downloadHtml = async () => {
    if (!detail) return;
    try {
      const res = await adminApi.get(`/orders/admin/${detail.id}/invoice/print`, { responseType: 'text' });
      const blob = new Blob([res.data], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${detail.invoiceNumber}_${detail.customerName || 'customer'}_${detail.customerPhone || 'no-phone'}.html`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('ইনভয়েস ডাউনলোড হয়েছে (প্রিন্ট → PDF হিসেবে সেভ করুন)');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const totalBadge = useMemo(() => number(pagination.total), [pagination.total]);

  return (
    <div>
      <PageHeader
        title="অর্ডার ম্যানেজমেন্ট"
        subtitle={`মোট ${totalBadge} টি অর্ডার`}
        actions={<Button variant="outline" icon={RefreshCw} onClick={load}>রিফ্রেশ</Button>}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Tabs value={status} onChange={(v) => updateFilter({ status: v === 'all' ? null : v })} tabs={TABS.map((t) => ({ ...t, count: counts[t.value] }))} />
      </div>

      <Toolbar>
        <form
          onSubmit={(e) => { e.preventDefault(); updateFilter({ search: searchInput || null }); }}
          className="flex overflow-hidden rounded-lg border border-gray-300 bg-white"
        >
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="অর্ডার নম্বর, নাম, মোবাইল…" className="h-9 w-56 px-3 text-sm outline-none" aria-label="অর্ডার খুঁজুন" />
          <button type="submit" className="bg-gray-100 px-3 text-gray-600 hover:bg-gray-200" aria-label="খুঁজুন"><Search className="h-4 w-4" /></button>
        </form>
        <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); updateFilter({ from: e.target.value || null }); }} className="h-9 w-36" aria-label="শুরুর তারিখ" />
        <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); updateFilter({ to: e.target.value || null }); }} className="h-9 w-36" aria-label="শেষ তারিখ" />
        {(search || from || to) && (
          <Button variant="ghost" size="sm" icon={X} onClick={() => { setSearchInput(''); setFrom(''); setTo(''); setParams(new URLSearchParams(), { replace: true }); }}>ফিল্টার মুছুন</Button>
        )}
      </Toolbar>

      {loading ? <PageSpinner /> : orders.length === 0 ? (
        <EmptyState title="কোনো অর্ডার পাওয়া যায়নি" description="ফিল্টার পরিবর্তন করে দেখুন।" />
      ) : (
        <div className="card overflow-hidden">
          <Table>
            <Thead>
              <tr>
                <Th>অর্ডার</Th>
                <Th>কাস্টমার</Th>
                <Th>এলাকা</Th>
                <Th>স্ট্যাটাস</Th>
                <Th>পেমেন্ট</Th>
                <Th className="text-right">মোট</Th>
                <Th className="text-right">অ্যাকশন</Th>
              </tr>
            </Thead>
            <Tbody>
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <Td>
                    <button onClick={() => openDetail(o.id)} className="font-medium text-brand-600 hover:underline">{o.orderNumber}</button>
                    <p className="text-[11px] text-gray-400">{dateTime(o.createdAt)}</p>
                  </Td>
                  <Td>
                    <p className="font-medium text-ink-900">{o.customerName || '—'}</p>
                    <p className="text-[11px] text-gray-500">{o.customerPhone}</p>
                  </Td>
                  <Td className="text-xs text-gray-600">{o.shippingAddress?.thana}, {o.shippingAddress?.district}</Td>
                  <Td><Badge tone={orderStatusTone(o.status)}>{orderStatusLabel(o.status)}</Badge></Td>
                  <Td>
                    <p className="text-xs">{PAYMENT_METHOD[o.paymentMethod] ?? o.paymentMethod}</p>
                    <p className={cn('text-[11px]', o.paymentStatus === 'paid' ? 'text-emerald-600' : 'text-amber-600')}>{paymentStatusLabel(o.paymentStatus)}</p>
                  </Td>
                  <Td className="text-right font-semibold tnum">{taka(o.total)}</Td>
                  <Td className="text-right">
                    <button onClick={() => openDetail(o.id)} className="rounded p-1.5 text-gray-500 hover:bg-brand-50 hover:text-brand-600" aria-label="বিস্তারিত"><Eye className="h-4 w-4" /></button>
                  </Td>
                </tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}

      <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={15} onChange={(p) => updateFilter({ page: String(p) })} />

      {/* Detail drawer */}
      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detail ? `অর্ডার ${detail.orderNumber}` : ''} size="xl">
        {detailLoading && <PageSpinner />}
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={orderStatusTone(detail.status)}>{orderStatusLabel(detail.status)}</Badge>
              <Badge tone={detail.paymentStatus === 'paid' ? 'green' : 'amber'}>{paymentStatusLabel(detail.paymentStatus)}</Badge>
              <span className="text-xs text-gray-500">{PAYMENT_METHOD[detail.paymentMethod] ?? detail.paymentMethod}</span>
              <span className="ml-auto text-xs text-gray-500">{dateTime(detail.createdAt)}</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="mb-1 text-xs font-semibold text-gray-500">কাস্টমার</p>
                <p className="text-sm font-medium text-ink-900">{detail.shippingAddress?.name}</p>
                <p className="flex items-center gap-1 text-xs text-gray-600"><Phone className="h-3 w-3" /> {detail.shippingAddress?.phone}</p>
                <p className="mt-1 flex items-start gap-1 text-xs text-gray-600">
                  <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                  {detail.shippingAddress?.address}, {detail.shippingAddress?.thana}, {detail.shippingAddress?.district}, {detail.shippingAddress?.division}
                </p>
                {detail.shippingAddress?.note && <p className="mt-1 text-xs italic text-gray-500">নোট: {detail.shippingAddress.note}</p>}
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="mb-1 text-xs font-semibold text-gray-500">হিসাব</p>
                <div className="space-y-0.5 text-xs">
                  <div className="flex justify-between"><span>সাবটোটাল</span><span className="tnum">{taka(detail.subtotal)}</span></div>
                  <div className="flex justify-between"><span>ডিসকাউন্ট</span><span className="tnum">-{taka(detail.discount)}</span></div>
                  <div className="flex justify-between"><span>ডেলিভারি</span><span className="tnum">{taka(detail.shippingCost)}</span></div>
                  <div className="flex justify-between border-t border-gray-200 pt-1 text-sm font-bold"><span>মোট</span><span className="text-brand-600 tnum">{taka(detail.total)}</span></div>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500">পণ্যসমূহ ({detail.items.length})</p>
                {can('orders:write') && <Button size="sm" variant="outline" icon={Pencil} onClick={openEdit}>পণ্য সম্পাদনা</Button>}
              </div>
              <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                {detail.items.map((it) => (
                  <div key={it.id} className="flex items-center gap-2 p-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-900">{it.productName}</p>
                      <p className="text-[11px] text-gray-500">{it.productSku} · {taka(it.price)} × {it.quantity}</p>
                    </div>
                    <p className="text-sm font-semibold tnum">{taka(it.lineTotal)}</p>
                  </div>
                ))}
              </div>
            </div>

            {can('orders:write') && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="mb-2 text-xs font-semibold text-gray-500">স্ট্যাটাস পরিবর্তন</p>
                  <Input placeholder="নোট (ঐচ্ছিক)" value={statusNote} onChange={(e) => setStatusNote(e.target.value)} className="mb-2" />
                  <div className="flex flex-wrap gap-1.5">
                    {(STATUS_FLOW[detail.status] ?? []).length === 0 && <p className="text-xs text-gray-400">এই স্ট্যাটাস থেকে আর পরিবর্তন করা যাবে না।</p>}
                    {(STATUS_FLOW[detail.status] ?? []).map((s) => (
                      <Button key={s} size="sm" variant={s === 'cancelled' || s === 'returned' ? 'danger' : 'primary'} loading={busy} onClick={() => changeStatus(s)}>
                        {orderStatusLabel(s)}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="mb-2 text-xs font-semibold text-gray-500">কুরিয়ার</p>
                  <Select value={courierId} onChange={(e) => setCourierId(e.target.value)} options={couriers.map((c) => ({ value: String(c.id), label: c.name }))} placeholder="কুরিয়ার নির্বাচন" className="mb-2" />
                  <Input placeholder="ট্র্যাকিং নম্বর" value={tracking} onChange={(e) => setTracking(e.target.value)} className="mb-2" />
                  <Button size="sm" icon={Truck} loading={busy} onClick={saveCourier}>সংরক্ষণ</Button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
              <Button size="sm" variant="outline" icon={Printer} onClick={openPrint}>ইনভয়েস প্রিন্ট</Button>
              <Button size="sm" variant="outline" icon={Download} onClick={downloadHtml}>ইনভয়েস ডাউনলোড</Button>
              <Button size="sm" variant="ghost" icon={FileText} onClick={loadInvoice}>ইনভয়েস ডেটা</Button>
              {invoice && <span className="text-xs text-gray-500">ফাইলনেম: {invoice.filename}</span>}
            </div>

            {invoice && (
              <div className="rounded-lg bg-gray-50 p-3 text-xs">
                <p className="font-semibold">ইনভয়েস নম্বর: {invoice.invoiceNumber}</p>
                <p>প্রস্তাবিত ফাইলনেম: <span className="font-mono">{invoice.filename}</span></p>
                <p className="mt-1 text-gray-500">প্রিন্ট ডায়ালগ থেকে “Save as PDF” বেছে নিলে এই নামেই সেভ করা যাবে।</p>
              </div>
            )}

            {detail.statusHistory && detail.statusHistory.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-gray-500">স্ট্যাটাস ইতিহাস</p>
                <ul className="space-y-1 text-xs text-gray-600">
                  {detail.statusHistory.map((h) => (
                    <li key={h.id} className="flex justify-between gap-2">
                      <span>{orderStatusLabel(h.status)}{h.note ? ` — ${h.note}` : ''}</span>
                      <span className="text-gray-400">{dateTime(h.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Edit items */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="অর্ডারের পণ্য সম্পাদনা"
        footer={<><Button variant="ghost" onClick={() => setEditOpen(false)}>বাতিল</Button><Button loading={busy} onClick={saveItems}>সংরক্ষণ</Button></>}
      >
        <p className="mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
          পরিমাণ ০ করলে পণ্যটি অর্ডার থেকে বাদ যাবে। মোট মূল্য সার্ভারে পুনরায় হিসাব হবে এবং অডিট লগে সংরক্ষিত থাকবে।
        </p>
        <div className="space-y-2">
          {detail?.items.map((it, idx) => (
            <div key={it.id} className="flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-sm">{it.productName}</p>
              <input
                type="number"
                min={0}
                value={editItems[idx]?.quantity ?? 0}
                onChange={(e) => setEditItems((list) => list.map((x, i) => (i === idx ? { ...x, quantity: Math.max(0, Number(e.target.value)) } : x)))}
                className="h-9 w-20 rounded-lg border border-gray-300 px-2 text-center text-sm"
                aria-label={`${it.productName} পরিমাণ`}
              />
            </div>
          ))}
        </div>
        <Input label="পরিবর্তনের কারণ (ঐচ্ছিক)" value={editReason} onChange={(e) => setEditReason(e.target.value)} className="mt-3" />
      </Modal>
    </div>
  );
}
