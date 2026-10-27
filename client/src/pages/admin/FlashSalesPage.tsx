import { useCallback, useEffect, useState } from 'react';
import { Plus, Zap, Trash2, Power, Pencil } from 'lucide-react';
import { adminApi, getApiErrorMessage } from '@/lib/api';
import { taka, dateTime } from '@/lib/format';
import { useAdmin } from '@/store/admin';
import { toast } from '@/lib/toast';
import {
  Badge, Button, ConfirmDialog, EmptyState, Input, Modal, Select, Switch, Table, Tbody, Td, Th, Thead, PageSpinner, Textarea,
} from '@/components/admin/ui';
import { PageHeader } from '@/components/layout/AdminLayout';

interface FlashSale {
  id: number; title: string; description?: string | null; type: string; value: number;
  productIds: number[]; categoryIds: number[]; startAt: string; endAt: string;
  stockLimit?: number | null; isActive: boolean; status: string;
}

const empty = { title: '', description: '', type: 'percentage', value: '', productIds: [] as number[], categoryIds: [] as number[], startAt: '', endAt: '', isActive: true };

export default function FlashSalesPage() {
  const can = useAdmin((s) => s.can);
  const [sales, setSales] = useState<FlashSale[]>([]);
  const [products, setProducts] = useState<Array<{ id: number; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FlashSale | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<FlashSale | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([adminApi.get('/flash-sales'), adminApi.get('/products/admin/all?limit=100'), adminApi.get('/categories')])
      .then(([s, p, c]) => {
        setSales(s.data.flashSales ?? []);
        setProducts(p.data.products ?? []);
        setCategories(c.data.categories ?? []);
      })
      .catch((err) => toast.error(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    const now = new Date();
    const end = new Date(now.getTime() + 3 * 86_400_000);
    setEditing(null);
    setForm({
      ...empty,
      startAt: new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16),
      endAt: new Date(end.getTime() - end.getTimezoneOffset() * 60_000).toISOString().slice(0, 16),
    });
    setError('');
    setOpen(true);
  };

  const openEdit = (s: FlashSale) => {
    setEditing(s);
    setForm({
      title: s.title, description: s.description ?? '', type: s.type, value: String(s.value),
      productIds: s.productIds ?? [], categoryIds: s.categoryIds ?? [],
      startAt: s.startAt.slice(0, 16), endAt: s.endAt.slice(0, 16), isActive: s.isActive,
    });
    setError('');
    setOpen(true);
  };

  const save = async () => {
    setError('');
    if (!form.productIds.length && !form.categoryIds.length) { setError('অন্তত একটি পণ্য বা ক্যাটাগরি নির্বাচন করুন।'); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || undefined,
        type: form.type,
        value: Number(form.value),
        productIds: form.productIds,
        categoryIds: form.categoryIds,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        isActive: form.isActive,
      };
      if (editing) { await adminApi.put(`/flash-sales/${editing.id}`, payload); toast.success('ফ্ল্যাশ সেল আপডেট হয়েছে'); }
      else { await adminApi.post('/flash-sales', payload); toast.success('ফ্ল্যাশ সেল তৈরি হয়েছে'); }
      setOpen(false);
      load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (s: FlashSale) => {
    try {
      await adminApi.patch(`/flash-sales/${s.id}/toggle`);
      toast.success('স্ট্যাটাস পরিবর্তন হয়েছে');
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await adminApi.delete(`/flash-sales/${deleting.id}`);
      toast.success('ফ্ল্যাশ সেল মুছে ফেলা হয়েছে');
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const toggleId = (key: 'productIds' | 'categoryIds', id: number) => {
    setForm((f) => ({ ...f, [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id] }));
  };

  const STATUS: Record<string, string> = { active: 'চলছে', scheduled: 'নির্ধারিত', expired: 'শেষ', inactive: 'নিষ্ক্রিয়' };

  return (
    <div>
      <PageHeader
        title="ফ্ল্যাশ সেল"
        subtitle="সময়সীমা ও পণ্য-ভিত্তিক ডিসকাউন্ট ক্যাম্পেইন"
        actions={can('flashsales:write') ? <Button icon={Plus} onClick={openCreate}>নতুন ফ্ল্যাশ সেল</Button> : undefined}
      />

      {loading ? <PageSpinner /> : sales.length === 0 ? (
        <EmptyState icon={Zap} title="কোনো ফ্ল্যাশ সেল নেই" description="সময়সীমা নির্ধারণ করে ডিসকাউন্ট চালু করুন।" />
      ) : (
        <div className="card overflow-x-auto">
          <Table>
            <Thead><tr><Th>শিরোনাম</Th><Th>ছাড়</Th><Th>সময়কাল</Th><Th>টার্গেট</Th><Th>স্ট্যাটাস</Th><Th className="text-right">অ্যাকশন</Th></tr></Thead>
            <Tbody>
              {sales.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <Td>
                    <p className="font-medium text-ink-900">{s.title}</p>
                    {s.description && <p className="max-w-[240px] truncate text-[11px] text-gray-500">{s.description}</p>}
                  </Td>
                  <Td className="font-semibold text-brand-600">{s.type === 'percentage' ? `${s.value}%` : taka(s.value)}</Td>
                  <Td className="text-xs text-gray-600">{dateTime(s.startAt)}<br />→ {dateTime(s.endAt)}</Td>
                  <Td className="text-xs text-gray-600">{s.productIds.length} পণ্য · {s.categoryIds.length} ক্যাটাগরি</Td>
                  <Td><Badge tone={s.status === 'active' ? 'green' : s.status === 'scheduled' ? 'blue' : 'gray'}>{STATUS[s.status] ?? s.status}</Badge></Td>
                  <Td className="text-right">
                    {can('flashsales:write') && (
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(s)} className="rounded p-1.5 text-gray-500 hover:bg-brand-50 hover:text-brand-600" aria-label="সম্পাদনা"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => toggle(s)} className={`rounded p-1.5 hover:bg-gray-100 ${s.isActive ? 'text-emerald-600' : 'text-gray-400'}`} aria-label="টগল"><Power className="h-4 w-4" /></button>
                        <button onClick={() => setDeleting(s)} className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600" aria-label="মুছুন"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'ফ্ল্যাশ সেল সম্পাদনা' : 'নতুন ফ্ল্যাশ সেল'}
        size="xl"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>বাতিল</Button><Button loading={saving} onClick={save}>সংরক্ষণ</Button></>}
      >
        {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Input label="শিরোনাম" requiredMark value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></div>
          <Select label="ছাড়ের ধরন" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} options={[{ value: 'percentage', label: 'শতকরা (%)' }, { value: 'flat', label: 'নির্দিষ্ট টাকা (৳)' }]} />
          <Input label="মান" type="number" requiredMark value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} />
          <Input label="শুরু" type="datetime-local" value={form.startAt} onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))} />
          <Input label="শেষ" type="datetime-local" value={form.endAt} onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))} />
          <div className="sm:col-span-2"><Textarea label="বিবরণ" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>

          <div>
            <p className="label">পণ্য নির্বাচন ({form.productIds.length})</p>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 p-2 text-sm">
              {products.map((p) => (
                <label key={p.id} className="flex items-center gap-2 py-0.5">
                  <input type="checkbox" checked={form.productIds.includes(p.id)} onChange={() => toggleId('productIds', p.id)} className="h-4 w-4 rounded border-gray-300 text-brand-500" />
                  <span className="truncate">{p.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="label">ক্যাটাগরি নির্বাচন ({form.categoryIds.length})</p>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 p-2 text-sm">
              {categories.map((c) => (
                <label key={c.id} className="flex items-center gap-2 py-0.5">
                  <input type="checkbox" checked={form.categoryIds.includes(c.id)} onChange={() => toggleId('categoryIds', c.id)} className="h-4 w-4 rounded border-gray-300 text-brand-500" />
                  <span className="truncate">{c.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2"><Switch checked={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} label="সক্রিয়" /></div>
        </div>
      </Modal>

      <ConfirmDialog open={Boolean(deleting)} title="ফ্ল্যাশ সেল মুছে ফেলবেন?" message={`"${deleting?.title}" মুছে ফেলা হবে।`} confirmLabel="মুছে ফেলুন" onCancel={() => setDeleting(null)} onConfirm={remove} />
    </div>
  );
}
