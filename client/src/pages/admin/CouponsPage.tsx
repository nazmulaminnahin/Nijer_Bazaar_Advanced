import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, TicketPercent, Trash2, Download, Eye, Power } from 'lucide-react';
import { adminApi, getApiErrorMessage } from '@/lib/api';
import { taka, number, dateTime, dateOnly } from '@/lib/format';
import { useAdmin } from '@/store/admin';
import { toast } from '@/lib/toast';
import {
  Badge, Button, ConfirmDialog, EmptyState, Input, Modal, Pagination, Select, Switch, Table, Tbody, Td, Th, Thead, Toolbar, PageSpinner, Textarea,
} from '@/components/admin/ui';
import { PageHeader } from '@/components/layout/AdminLayout';

interface Coupon {
  id: number; code: string; description?: string | null; type: string; value: number;
  minOrderAmount: number | null; maxDiscountAmount: number | null; usageLimit: number | null;
  maxUsesPerUser: number; usedCount: number; startsAt: string; expiresAt: string;
  isActive: boolean; status: string; terms?: string | null;
}

const TYPES = [
  { value: 'percentage', label: 'শতকরা (%)' },
  { value: 'flat', label: 'নির্দিষ্ট টাকা (৳)' },
  { value: 'free_shipping', label: 'ফ্রি ডেলিভারি' },
];

const STATUS_LABEL: Record<string, string> = {
  active: 'সক্রিয়', inactive: 'নিষ্ক্রিয়', expired: 'মেয়াদোত্তীর্ণ', scheduled: 'নির্ধারিত', exhausted: 'শেষ হয়েছে',
};

const empty = {
  code: '', description: '', type: 'percentage', value: '', minOrderAmount: '', maxDiscount: '',
  usageLimit: '', maxUsesPerUser: '1', startsAt: '', expiresAt: '', isActive: true, terms: '',
};

export default function CouponsPage() {
  const can = useAdmin((s) => s.can);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<Coupon | null>(null);
  const [design, setDesign] = useState<{ coupon: Coupon; svg: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) q.set('search', search);
    adminApi.get(`/coupons?${q.toString()}`)
      .then((res) => {
        setCoupons(res.data.coupons ?? []);
        setPagination({ page: res.data.pagination?.page ?? 1, totalPages: res.data.pagination?.totalPages ?? 1, total: res.data.pagination?.total ?? res.data.total ?? 0 });
      })
      .catch((err) => toast.error(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setError('');
    setSaving(true);
    try {
      await adminApi.post('/coupons', {
        code: form.code.trim() || undefined,
        description: form.description || undefined,
        type: form.type,
        value: Number(form.value) || 0,
        minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : null,
        maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
        maxUsesPerUser: Number(form.maxUsesPerUser) || 1,
        startsAt: form.startsAt || undefined,
        expiresAt: form.expiresAt || undefined,
        isActive: form.isActive,
        terms: form.terms || undefined,
      });
      toast.success('কুপন তৈরি হয়েছে');
      setOpen(false);
      setForm({ ...empty });
      load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c: Coupon) => {
    try {
      await adminApi.patch(`/coupons/${c.id}/toggle`);
      toast.success('স্ট্যাটাস পরিবর্তন হয়েছে');
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await adminApi.delete(`/coupons/${deleting.id}`);
      toast.success('কুপন মুছে ফেলা হয়েছে');
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const openDesign = async (c: Coupon) => {
    try {
      const res = await adminApi.get(`/coupons/${c.id}/design`, { responseType: 'text' });
      setDesign({ coupon: c, svg: res.data });
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const downloadDesign = async (c: Coupon) => {
    try {
      const res = await adminApi.get(`/coupons/${c.id}/design?format=download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `coupon-${c.code}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const valueText = (c: Coupon) =>
    c.type === 'percentage' ? `${c.value}%` : c.type === 'flat' ? taka(c.value) : 'ফ্রি ডেলিভারি';

  return (
    <div>
      <PageHeader
        title="কুপন ও ডিসকাউন্ট"
        subtitle={`মোট ${number(pagination.total)} টি কুপন`}
        actions={can('coupons:write') ? <Button icon={Plus} onClick={() => { setForm({ ...empty }); setOpen(true); }}>নতুন কুপন</Button> : undefined}
      />

      <Toolbar>
        <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1); }} className="flex overflow-hidden rounded-lg border border-gray-300 bg-white">
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="কুপন কোড…" className="h-9 w-48 px-3 text-sm outline-none" aria-label="কুপন খুঁজুন" />
          <button type="submit" className="bg-gray-100 px-3 text-gray-600 hover:bg-gray-200" aria-label="খুঁজুন"><Search className="h-4 w-4" /></button>
        </form>
      </Toolbar>

      {loading ? <PageSpinner /> : coupons.length === 0 ? (
        <EmptyState icon={TicketPercent} title="কোনো কুপন নেই" description="নতুন কুপন তৈরি করে গ্রাহকদের অফার দিন।" />
      ) : (
        <div className="card overflow-x-auto">
          <Table>
            <Thead>
              <tr><Th>কোড</Th><Th>ধরন</Th><Th>শর্ত</Th><Th>ব্যবহার</Th><Th>মেয়াদ</Th><Th>স্ট্যাটাস</Th><Th className="text-right">অ্যাকশন</Th></tr>
            </Thead>
            <Tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <Td>
                    <p className="font-mono font-semibold text-brand-700">{c.code}</p>
                    {c.description && <p className="max-w-[220px] truncate text-[11px] text-gray-500">{c.description}</p>}
                  </Td>
                  <Td className="text-xs">{TYPES.find((t) => t.value === c.type)?.label ?? c.type}<p className="font-semibold text-ink-900">{valueText(c)}</p></Td>
                  <Td className="text-xs text-gray-600">
                    {c.minOrderAmount ? `সর্বনিম্ন ${taka(c.minOrderAmount)}` : 'কোনো সীমা নেই'}
                    {c.maxDiscountAmount && <p className="text-[11px]">সর্বোচ্চ ছাড় {taka(c.maxDiscountAmount)}</p>}
                  </Td>
                  <Td className="text-xs tnum">
                    {c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ''}
                    <p className="text-[11px] text-gray-400">প্রতি জন {c.maxUsesPerUser} বার</p>
                  </Td>
                  <Td className="text-xs text-gray-600">{dateOnly(c.startsAt)} → {dateOnly(c.expiresAt)}</Td>
                  <Td><Badge tone={c.status === 'active' ? 'green' : c.status === 'expired' ? 'red' : c.status === 'scheduled' ? 'blue' : 'gray'}>{STATUS_LABEL[c.status] ?? c.status}</Badge></Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openDesign(c)} className="rounded p-1.5 text-gray-500 hover:bg-brand-50 hover:text-brand-600" aria-label="ডিজাইন দেখুন"><Eye className="h-4 w-4" /></button>
                      <button onClick={() => downloadDesign(c)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100" aria-label="ডিজাইন ডাউনলোড"><Download className="h-4 w-4" /></button>
                      {can('coupons:write') && (
                        <>
                          <button onClick={() => toggle(c)} className={`rounded p-1.5 hover:bg-gray-100 ${c.isActive ? 'text-emerald-600' : 'text-gray-400'}`} aria-label="টগল"><Power className="h-4 w-4" /></button>
                          <button onClick={() => setDeleting(c)} className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600" aria-label="মুছুন"><Trash2 className="h-4 w-4" /></button>
                        </>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}

      <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={20} onChange={setPage} />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="নতুন কুপন"
        size="lg"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>বাতিল</Button><Button loading={saving} onClick={save}>তৈরি করুন</Button></>}
      >
        {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="কুপন কোড" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} hint="খালি রাখলে অটো তৈরি হবে" />
          <Select label="ধরন" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} options={TYPES} />
          <Input label="মান" type="number" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} hint={form.type === 'percentage' ? '১–১০০' : form.type === 'flat' ? 'টাকায়' : 'ফ্রি ডেলিভারিতে মান লাগে না'} />
          <Input label="সর্বোচ্চ ছাড় (৳)" type="number" value={form.maxDiscount} onChange={(e) => setForm((f) => ({ ...f, maxDiscount: e.target.value }))} />
          <Input label="সর্বনিম্ন অর্ডার (৳)" type="number" value={form.minOrderAmount} onChange={(e) => setForm((f) => ({ ...f, minOrderAmount: e.target.value }))} />
          <Input label="মোট ব্যবহারের সীমা" type="number" value={form.usageLimit} onChange={(e) => setForm((f) => ({ ...f, usageLimit: e.target.value }))} />
          <Input label="প্রতি গ্রাহক" type="number" min={1} value={form.maxUsesPerUser} onChange={(e) => setForm((f) => ({ ...f, maxUsesPerUser: e.target.value }))} />
          <Input label="শুরুর তারিখ" type="date" value={form.startsAt} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} />
          <Input label="মেয়াদ শেষ" type="date" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))} />
          <div className="sm:col-span-2"><Input label="বিবরণ" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
          <div className="sm:col-span-2"><Textarea label="শর্তাবলী" rows={3} value={form.terms} onChange={(e) => setForm((f) => ({ ...f, terms: e.target.value }))} /></div>
          <div className="sm:col-span-2"><Switch checked={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} label="সক্রিয়" /></div>
        </div>
      </Modal>

      <Modal open={Boolean(design)} onClose={() => setDesign(null)} title={design ? `কুপন ডিজাইন — ${design.coupon.code}` : ''} size="lg">
        {design && (
          <div>
            <div className="overflow-hidden rounded-lg border border-gray-200" dangerouslySetInnerHTML={{ __html: design.svg }} />
            <div className="mt-3 flex justify-end">
              <Button icon={Download} onClick={() => downloadDesign(design.coupon)}>PNG ডাউনলোড</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={Boolean(deleting)} title="কুপন মুছে ফেলবেন?" message={`${deleting?.code} মুছে ফেলা হবে।`} confirmLabel="মুছে ফেলুন" onCancel={() => setDeleting(null)} onConfirm={remove} />
    </div>
  );
}
