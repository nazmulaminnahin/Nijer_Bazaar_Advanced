import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, ArrowDownCircle, ArrowUpCircle, Wallet } from 'lucide-react';
import { adminApi, getApiErrorMessage } from '@/lib/api';
import { taka, number, dateOnly, today } from '@/lib/format';
import { useAdmin } from '@/store/admin';
import { toast } from '@/lib/toast';
import {
  Badge, Button, ConfirmDialog, EmptyState, Input, Modal, Pagination, Select, StatCard, Table, Tbody, Td, Th, Thead, Toolbar, PageSpinner, Textarea,
} from '@/components/admin/ui';
import { PageHeader } from '@/components/layout/AdminLayout';

interface Transaction {
  id: number; reference: string; type: string; category: string; amount: number;
  paymentMethod: string; status: string; description?: string | null; orderId?: number | null;
  orderNumber?: string | null; transactionDate: string;
}

const TYPES = [
  { value: 'all', label: 'সব লেনদেন' },
  { value: 'income', label: 'আয়' },
  { value: 'refund', label: 'রিফান্ড' },
];
const METHOD: Record<string, string> = { cash: 'ক্যাশ', bkash: 'বিকাশ', nagad: 'নগদ', bank: 'ব্যাংক', card: 'কার্ড' };

export default function TransactionsPage() {
  const can = useAdmin((s) => s.can);
  const [rows, setRows] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState({ income: 0, refunds: 0, entries: 0 });
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [type, setType] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: 'income', amount: '', category: 'sales', description: '', paymentMethod: 'cash', reference: '', transactionDate: today() });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<Transaction | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), limit: '20', type });
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    adminApi.get(`/accounting/transactions?${q.toString()}`)
      .then((res) => {
        setRows(res.data.transactions ?? []);
        setSummary(res.data.summary ?? { income: 0, refunds: 0, entries: 0 });
        setPagination({ page: res.data.pagination?.page ?? 1, totalPages: res.data.pagination?.totalPages ?? 1, total: res.data.total ?? 0 });
      })
      .catch((err) => toast.error(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [page, type, from, to]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setError('');
    setSaving(true);
    try {
      await adminApi.post('/accounting/transactions', {
        type: form.type,
        amount: Number(form.amount),
        category: form.category || 'general',
        description: form.description || undefined,
        paymentMethod: form.paymentMethod,
        reference: form.reference || undefined,
        transactionDate: form.transactionDate || undefined,
      });
      toast.success('লেনদেন সংরক্ষণ হয়েছে');
      setOpen(false);
      setForm({ type: 'income', amount: '', category: 'sales', description: '', paymentMethod: 'cash', reference: '', transactionDate: today() });
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
      await adminApi.delete(`/accounting/transactions/${deleting.id}`);
      toast.success('লেনদেন মুছে ফেলা হয়েছে');
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="লেনদেন (Transactions)"
        subtitle="প্রকৃতপক্ষে গৃহীত আয় ও রিফান্ড — খরচ আলাদা পেজে"
        actions={can('accounting:write') ? <Button icon={Plus} onClick={() => setOpen(true)}>নতুন লেনদেন</Button> : undefined}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="মোট আয়" value={taka(summary.income)} icon={ArrowUpCircle} tone="green" />
        <StatCard label="মোট রিফান্ড" value={taka(summary.refunds)} icon={ArrowDownCircle} tone="red" />
        <StatCard label="লেনদেন সংখ্যা" value={number(summary.entries)} icon={Wallet} />
      </div>

      <Toolbar>
        <Select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} options={TYPES} className="h-9 w-40" aria-label="ধরন" />
        <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="h-9 w-36" aria-label="শুরুর তারিখ" />
        <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="h-9 w-36" aria-label="শেষ তারিখ" />
      </Toolbar>

      {loading ? <PageSpinner /> : rows.length === 0 ? (
        <EmptyState title="কোনো লেনদেন নেই" description="নতুন লেনদেন যোগ করে হিসাব রাখুন।" />
      ) : (
        <div className="card overflow-x-auto">
          <Table>
            <Thead><tr><Th>রেফারেন্স</Th><Th>ধরন</Th><Th>ক্যাটাগরি</Th><Th>অর্ডার</Th><Th>পদ্ধতি</Th><Th className="text-right">পরিমাণ</Th><Th>তারিখ</Th><Th className="text-right">অ্যাকশন</Th></tr></Thead>
            <Tbody>
              {rows.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <Td className="font-mono text-xs">{t.reference}<p className="max-w-[200px] truncate text-[11px] text-gray-500">{t.description}</p></Td>
                  <Td><Badge tone={t.type === 'income' ? 'green' : t.type === 'refund' ? 'red' : 'gray'}>{t.type === 'income' ? 'আয়' : t.type === 'refund' ? 'রিফান্ড' : t.type}</Badge></Td>
                  <Td className="text-xs">{t.category}</Td>
                  <Td className="text-xs text-gray-500">{t.orderNumber ?? '—'}</Td>
                  <Td className="text-xs">{METHOD[t.paymentMethod] ?? t.paymentMethod}</Td>
                  <Td className={`text-right font-semibold tnum ${t.type === 'refund' ? 'text-red-600' : 'text-emerald-600'}`}>{taka(t.amount)}</Td>
                  <Td className="text-xs text-gray-500">{dateOnly(t.transactionDate)}</Td>
                  <Td className="text-right">
                    {can('accounting:write') && <button onClick={() => setDeleting(t)} className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600" aria-label="মুছুন"><Trash2 className="h-4 w-4" /></button>}
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
        title="নতুন লেনদেন"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>বাতিল</Button><Button loading={saving} onClick={save}>সংরক্ষণ</Button></>}
      >
        {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="ধরন" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} options={[{ value: 'income', label: 'আয়' }, { value: 'refund', label: 'রিফান্ড' }]} />
          <Input label="পরিমাণ (৳)" requiredMark type="number" min={1} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          <Input label="ক্যাটাগরি" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
          <Select label="পেমেন্ট পদ্ধতি" value={form.paymentMethod} onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))} options={Object.entries(METHOD).map(([value, label]) => ({ value, label }))} />
          <Input label="রেফারেন্স" value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} hint="খালি রাখলে অটো তৈরি হবে" />
          <Input label="তারিখ" type="date" value={form.transactionDate} onChange={(e) => setForm((f) => ({ ...f, transactionDate: e.target.value }))} />
          <div className="sm:col-span-2"><Textarea label="বিবরণ" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
        </div>
      </Modal>

      <ConfirmDialog open={Boolean(deleting)} title="লেনদেন মুছে ফেলবেন?" message={`${deleting?.reference} — ${taka(deleting?.amount ?? 0)} মুছে ফেলা হবে।`} confirmLabel="মুছে ফেলুন" onCancel={() => setDeleting(null)} onConfirm={remove} />
    </div>
  );
}
