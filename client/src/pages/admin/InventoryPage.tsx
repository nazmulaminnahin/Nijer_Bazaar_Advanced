import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Boxes, Search, SlidersHorizontal, AlertTriangle } from 'lucide-react';
import { adminApi, getApiErrorMessage } from '@/lib/api';
import { taka, number, dateTime } from '@/lib/format';
import { useAdmin } from '@/store/admin';
import { toast } from '@/lib/toast';
import {
  Badge, Button, EmptyState, Input, Modal, Pagination, Select, StatCard, Table, Tbody, Td, Th, Thead, Tabs, Toolbar, PageSpinner,
} from '@/components/admin/ui';
import { PageHeader } from '@/components/layout/AdminLayout';

export default function InventoryPage() {
  const can = useAdmin((s) => s.can);
  const [params, setParams] = useSearchParams();
  const filter = params.get('filter') ?? 'all';
  const page = Number(params.get('page') ?? 1);
  const [rows, setRows] = useState<Array<{ id: number; name: string; sku: string; stock: number; lowStockThreshold: number; price: number; salePrice: number | null; isActive: boolean }>>([]);
  const [logs, setLogs] = useState<Array<Record<string, any>>>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [adjust, setAdjust] = useState<{ product: (typeof rows)[number] | null }>({ product: null });
  const [adjustForm, setAdjustForm] = useState({ type: 'purchase', quantity: '1', note: '' });
  const [busy, setBusy] = useState(false);
  const [all, setAll] = useState<Array<{ stock: number; lowStockThreshold: number; price: number; salePrice: number | null }>>([]);

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), limit: '20' });
    if (filter === 'low') q.set('filter', 'low');
    adminApi.get(`/admin/inventory?${q.toString()}`)
      .then((res) => {
        setRows(res.data.inventory ?? res.data.products ?? []);
        setPagination({ page: res.data.pagination?.page ?? 1, totalPages: res.data.pagination?.totalPages ?? 1, total: res.data.pagination?.total ?? res.data.total ?? 0 });
      })
      .catch((err) => toast.error(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
    adminApi.get('/admin/inventory/logs?limit=50').then((res) => setLogs(res.data.logs ?? [])).catch(() => undefined);
    // Everything, so the KPI cards describe the whole catalogue (not just this page).
    adminApi.get('/admin/inventory?limit=500').then((res) => setAll(res.data.inventory ?? res.data.products ?? [])).catch(() => undefined);
  }, [page, filter]);

  useEffect(() => { load(); }, [load]);

  const saveAdjust = async () => {
    if (!adjust.product) return;
    setBusy(true);
    try {
      await adminApi.post('/admin/inventory/adjust', {
        productId: adjust.product.id,
        type: adjustForm.type,
        quantity: Number(adjustForm.quantity),
        note: adjustForm.note || undefined,
      });
      toast.success('স্টক আপডেট হয়েছে');
      setAdjust({ product: null });
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const visible = rows.filter((r) => !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.sku?.toLowerCase().includes(search.toLowerCase()));
  const scope = all.length ? all : rows;
  const lowCount = scope.filter((r) => r.stock > 0 && r.stock <= r.lowStockThreshold).length;
  const outOfStock = scope.filter((r) => r.stock === 0).length;
  const stockValue = scope.reduce((sum, r) => sum + r.stock * Number(r.salePrice ?? r.price), 0);

  return (
    <div>
      <PageHeader title="ইনভেন্টরি" subtitle="স্টক পর্যবেক্ষণ ও সমন্বয়" actions={<Button variant="outline" icon={Boxes} onClick={load}>রিফ্রেশ</Button>} />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="মোট পণ্য" value={number(scope.length)} icon={Boxes} />
        <StatCard label="স্টক কম" value={number(lowCount)} icon={AlertTriangle} tone="amber" />
        <StatCard label="স্টক শেষ" value={number(outOfStock)} icon={AlertTriangle} tone="red" />
        <StatCard label="স্টক মূল্য (বিক্রয় মূল্যে)" value={taka(stockValue)} icon={Boxes} tone="green" />
      </div>

      <Tabs
        value={filter}
        onChange={(v) => setParams(v === 'all' ? {} : { filter: v }, { replace: true })}
        tabs={[{ value: 'all', label: 'সব পণ্য' }, { value: 'low', label: 'স্টক কম' }]}
        className="mb-3"
      />

      <Toolbar>
        <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3">
          <Search className="h-4 w-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="পণ্য বা SKU খুঁজুন" className="h-9 w-52 bg-transparent text-sm outline-none" aria-label="ইনভেন্টরি খুঁজুন" />
        </div>
      </Toolbar>

      {loading ? <PageSpinner /> : visible.length === 0 ? (
        <EmptyState title="কোনো পণ্য নেই" description="পণ্য তালিকা থেকে পণ্য যোগ করুন।" />
      ) : (
        <div className="card overflow-x-auto">
          <Table>
            <Thead><tr><Th>পণ্য</Th><Th className="text-right">দাম</Th><Th className="text-right">স্টক</Th><Th className="text-right">থ্রেশহোল্ড</Th><Th>অবস্থা</Th><Th className="text-right">অ্যাকশন</Th></tr></Thead>
            <Tbody>
              {visible.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <Td><p className="font-medium text-ink-900">{r.name}</p><p className="text-[11px] text-gray-400">{r.sku}</p></Td>
                  <Td className="text-right tnum">{taka(r.salePrice ?? r.price)}</Td>
                  <Td className="text-right font-semibold tnum">{r.stock}</Td>
                  <Td className="text-right tnum text-gray-500">{r.lowStockThreshold}</Td>
                  <Td>
                    {r.stock === 0 ? <Badge tone="red">স্টক শেষ</Badge> : r.stock <= r.lowStockThreshold ? <Badge tone="amber">স্টক কম</Badge> : <Badge tone="green">পর্যাপ্ত</Badge>}
                  </Td>
                  <Td className="text-right">
                    {can('inventory:write') && (
                      <Button size="xs" variant="outline" icon={SlidersHorizontal} onClick={() => { setAdjust({ product: r }); setAdjustForm({ type: 'purchase', quantity: '1', note: '' }); }}>সমন্বয়</Button>
                    )}
                  </Td>
                </tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}

      <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={20} onChange={(p) => setParams({ ...(filter === 'all' ? {} : { filter }), page: String(p) }, { replace: true })} />

      <div className="mt-5 card overflow-x-auto">
        <div className="border-b border-gray-100 px-4 py-2.5"><h2 className="text-sm font-semibold text-ink-900">সাম্প্রতিক স্টক লগ</h2></div>
        {logs.length === 0 ? <EmptyState title="কোনো লগ নেই" /> : (
          <Table>
            <Thead><tr><Th>পণ্য</Th><Th>ধরন</Th><Th className="text-right">পরিমাণ</Th><Th className="text-right">আগে → পরে</Th><Th>কারণ</Th><Th>সময়</Th></tr></Thead>
            <Tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <Td className="font-medium">{l.productName ?? `#${l.productId}`}</Td>
                  <Td className="text-xs">{l.type}</Td>
                  <Td className={`text-right font-semibold tnum ${l.quantity > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{l.quantity > 0 ? '+' : ''}{l.quantity}</Td>
                  <Td className="text-right tnum text-gray-500">{l.previousStock} → {l.newStock}</Td>
                  <Td className="text-xs text-gray-600">{l.reason}</Td>
                  <Td className="text-xs text-gray-400">{dateTime(l.createdAt)}</Td>
                </tr>
              ))}
            </Tbody>
          </Table>
        )}
      </div>

      <Modal
        open={Boolean(adjust.product)}
        onClose={() => setAdjust({ product: null })}
        title="স্টক সমন্বয়"
        footer={<><Button variant="ghost" onClick={() => setAdjust({ product: null })}>বাতিল</Button><Button loading={busy} onClick={saveAdjust}>সংরক্ষণ</Button></>}
      >
        <p className="mb-3 text-sm text-gray-600">{adjust.product?.name} — বর্তমান স্টক <span className="font-semibold">{adjust.product?.stock}</span></p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="ধরন" value={adjustForm.type} onChange={(e) => setAdjustForm((f) => ({ ...f, type: e.target.value }))} options={[
            { value: 'purchase', label: 'ক্রয় (যোগ)' },
            { value: 'return', label: 'রিটার্ন (যোগ)' },
            { value: 'adjustment', label: 'সমন্বয়' },
            { value: 'damaged', label: 'নষ্ট (বিয়োগ)' },
            { value: 'sale', label: 'বিক্রয় (বিয়োগ)' },
          ]} />
          <Input label="পরিমাণ" type="number" value={adjustForm.quantity} onChange={(e) => setAdjustForm((f) => ({ ...f, quantity: e.target.value }))} hint="যোগ করতে ধনাত্মক, বিয়োগ করতে ঋণাত্মক" />
          <div className="sm:col-span-2"><Input label="কারণ / নোট" value={adjustForm.note} onChange={(e) => setAdjustForm((f) => ({ ...f, note: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}
