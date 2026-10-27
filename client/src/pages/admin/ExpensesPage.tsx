import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Wallet, TrendingDown } from 'lucide-react';
import { adminApi, getApiErrorMessage } from '@/lib/api';
import { taka, number, dateOnly, today } from '@/lib/format';
import { useAdmin } from '@/store/admin';
import { toast } from '@/lib/toast';
import {
  Button, ConfirmDialog, EmptyState, Input, Modal, Pagination, Select, StatCard, Table, Tbody, Td, Th, Thead, Toolbar, PageSpinner, Textarea, Badge,
} from '@/components/admin/ui';
import { PageHeader } from '@/components/layout/AdminLayout';

interface Expense {
  id: number; title: string; category: string; amount: number; paymentMethod: string;
  description?: string | null; date: string; reference: string;
}

const CATEGORIES = [
  { value: 'rent', label: 'ভাড়া' }, { value: 'salary', label: 'বেতন' }, { value: 'marketing', label: 'মার্কেটিং' },
  { value: 'utilities', label: 'ইউটিলিটি' }, { value: 'transport', label: 'পরিবহন' }, { value: 'packaging', label: 'প্যাকেজিং' },
  { value: 'other', label: 'অন্যান্য' },
];
const METHOD: Record<string, string> = { cash: 'ক্যাশ', bkash: 'বিকাশ', nagad: 'নগদ', bank: 'ব্যাংক', card: 'কার্ড' };

export default function ExpensesPage() {
  const can = useAdmin((s) => s.can);
  const [rows, setRows] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<{ totalAmount: number; entries: number; byCategory: Array<{ category: string; total: number }> }>({ totalAmount: 0, entries: 0, byCategory: [] });
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'other', amount: '', paymentMethod: 'cash', description: '', date: today(), reference: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<Expense | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), limit: '20', category });
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    adminApi.get(`/accounting/expenses?${q.toString()}`)
      .then((res) => {
        setRows(res.data.expenses ?? []);
        setSummary(res.data.summary ?? { totalAmount: 0, entries: 0, byCategory: [] });
        setPagination({ page: res.data.pagination?.page ?? 1, totalPages: res.data.pagination?.totalPages ?? 1, total: res.data.total ?? 0 });
      })
      .catch((err) => toast.error(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [page, category, from, to]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setError('');
    setSaving(true);
    try {
      await adminApi.post('/accounting/expenses', {
        title: form.title,
        category: form.category,
        amount: Number(form.amount),
        paymentMethod: form.paymentMethod,
        description: form.description || undefined,
        date: form.date || undefined,
        reference: form.reference || undefined,
      });
      toast.success('খরচ সংরক্ষণ হয়েছে');
      setOpen(false);
      setForm({ title: '', category: 'other', amount: '', paymentMethod: 'cash', description: '', date: today(), reference: '' });
      load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await adminApi.delete(`/accounting/expenses/${deleting.id}`);
      toast.success('খরচ মুছে ফেলা হয়েছে');
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="খরচ (Expenses)"
        subtitle="ব্যবসার ব্যয় — লেনদেন থেকে সম্পূর্ণ আলাদা খাতা"
        actions={can('accounting:write') ? <Button icon={Plus} onClick={() => setOpen(true)}>নতুন খরচ</Button> : undefined}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="মোট খরচ" value={taka(summary.totalAmount)} icon={TrendingDown} tone="red" />
        <StatCard label="এন্ট্রি সংখ্যা" value={number(summary.entries)} icon={Wallet} />
        <StatCard
          label="সর্বোচ্চ খাত"
          value={summary.byCategory.length ? (CATEGORIES.find((c) => c.value === [...summary.byCategory].sort((a, b) => b.total - a.total)[0].category)?.label ?? [...summary.byCategory].sort((a, b) => b.total - a.total)[0].category) : '—'}
          hint={summary.byCategory.length ? taka([...summary.byCategory].sort((a, b) => b.total - a.total)[0].total) : undefined}
          icon={Wallet}
          tone="amber"
        />
      </div>

      <Toolbar>
        <Select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} options={[{ value: 'all', label: 'সব খাত' }, ...CATEGORIES]} className="h-9 w-40" aria-label="খরচের খাত" />
        <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="h-9 w-36" aria-label="শুরুর তারিখ" />
        <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="h-9 w-36" aria-label="শেষ তারিখ" />
      </Toolbar>

      {loading ? <PageSpinner /> : rows.length === 0 ? (
        <EmptyState title="কোনো খরচ নেই" description="খরচ যোগ করে হিসাব সম্পূর্ণ করুন।" />
      ) : (
        <div className="card overflow-x-auto">
          <Table>
            <Thead><tr><Th>বিবরণ</Th><Th>খাত</Th><Th>রেফারেন্স</Th><Th>পদ্ধতি</Th><Th className="text-right">পরিমাণ</Th><Th>তারিখ</Th><Th className="text-right">অ্যাকশন</Th></tr></Thead>
            <Tbody>
              {rows.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <Td><p className="font-medium text-ink-900">{e.title}</p>{e.description && <p className="max-w-[220px] truncate text-[11px] text-gray-500">{e.description}</p>}</Td>
                  <Td><Badge tone="gray">{CATEGORIES.find((c) => c.value === e.category)?.label ?? e.category}</Badge></Td>
                  <Td className="font-mono text-xs text-gray-500">{e.reference}</Td>
                  <Td className="text-xs">{METHOD[e.paymentMethod] ?? e.paymentMethod}</Td>
                  <Td className="text-right font-semibold text-red-600 tnum">{taka(e.amount)}</Td>
                  <Td className="text-xs text-gray-500">{dateOnly(e.date)}</Td>
                  <Td className="text-right">
                    {can('accounting:write') && <button onClick={() => setDeleting(e)} className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600" aria-label="মুছুন"><Trash2 className="h-4 w-4" /></button>}
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
        title="নতুন খরচ"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>বাতিল</Button><Button loading={saving} onClick={save}>সংরক্ষণ</Button></>}
      >
        {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Input label="বিবরণ / শিরোনাম" requiredMark value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></div>
          <Select label="খাত" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} options={CATEGORIES} />
          <Input label="পরিমাণ (৳)" requiredMark type="number" min={1} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          <Select label="পেমেন্ট পদ্ধতি" value={form.paymentMethod} onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))} options={Object.entries(METHOD).map(([value, label]) => ({ value, label }))} />
          <Input label="তারিখ" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          <Input label="রেফারেন্স" value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} hint="ঐচ্ছিক" />
          <div className="sm:col-span-2"><Textarea label="নোট" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
        </div>
      </Modal>

      <ConfirmDialog open={Boolean(deleting)} title="খরচ মুছে ফেলবেন?" message={`${deleting?.title} — ${taka(deleting?.amount ?? 0)} মুছে ফেলা হবে।`} confirmLabel="মুছে ফেলুন" onCancel={() => setDeleting(null)} onConfirm={remove} />
    </div>
  );
}
