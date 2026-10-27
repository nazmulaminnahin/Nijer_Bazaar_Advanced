import { useCallback, useEffect, useState } from 'react';
import { Plus, Gift, Search, Eye, Download, Power, Wallet, Trash2 } from 'lucide-react';
import { adminApi, getApiErrorMessage } from '@/lib/api';
import { taka, number, dateTime, dateOnly } from '@/lib/format';
import { useAdmin } from '@/store/admin';
import { toast } from '@/lib/toast';
import {
  Badge, Button, ConfirmDialog, EmptyState, Input, Modal, Pagination, Select, StatCard, Table, Tbody, Td, Th, Thead, Toolbar, PageSpinner, Textarea, Tabs,
} from '@/components/admin/ui';
import { PageHeader } from '@/components/layout/AdminLayout';

interface Card {
  id: number; code: string; initialAmount: number; remainingAmount: number; status: string;
  isActive: boolean; design: string; recipientName?: string | null; recipientPhone?: string | null;
  message?: string | null; expiresAt: string | null; createdAt: string;
}
interface Ledger {
  card: Card;
  transactions: Array<{ id: number; type: string; amount: number; balanceAfter: number; note?: string | null; createdAt: string }>;
}

const STATUS_TABS = [
  { value: 'all', label: 'সব' },
  { value: 'active', label: 'সক্রিয়' },
  { value: 'redeemed', label: 'ব্যবহৃত' },
  { value: 'inactive', label: 'নিষ্ক্রিয়' },
];

export default function GiftCardsPage() {
  const can = useAdmin((s) => s.can);
  const [cards, setCards] = useState<Card[]>([]);
  const [summary, setSummary] = useState({ cards: 0, outstanding: 0 });
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ amount: '500', quantity: '1', design: 'classic', expiresAt: '', recipientName: '', recipientPhone: '', message: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<Card[] | null>(null);

  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [adjust, setAdjust] = useState<{ card: Card | null; type: string; amount: string; note: string }>({ card: null, type: 'credit', amount: '', note: '' });
  const [design, setDesign] = useState<{ card: Card; side: 'front' | 'back'; svg: string } | null>(null);
  const [deleting, setDeleting] = useState<Card | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), limit: '20' });
    if (status !== 'all') q.set('status', status);
    if (search) q.set('search', search);
    adminApi.get(`/gift-cards?${q.toString()}`)
      .then((res) => {
        setCards(res.data.cards ?? []);
        setSummary(res.data.summary ?? { cards: 0, outstanding: 0 });
        setPagination({ page: res.data.pagination?.page ?? 1, totalPages: res.data.pagination?.totalPages ?? 1, total: res.data.total ?? 0 });
      })
      .catch((err) => toast.error(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [page, status, search]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setError('');
    setSaving(true);
    try {
      const res = await adminApi.post('/gift-cards', {
        amount: Number(form.amount),
        quantity: Number(form.quantity),
        design: form.design,
        expiresAt: form.expiresAt || null,
        recipientName: form.recipientName || undefined,
        recipientPhone: form.recipientPhone || undefined,
        message: form.message || undefined,
      });
      toast.success(res.data.message);
      setCreated(res.data.cards ?? []);
      setCreateOpen(false);
      load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openLedger = async (id: number) => {
    try {
      const res = await adminApi.get(`/gift-cards/${id}`);
      setLedger({ card: res.data.card, transactions: res.data.transactions ?? [] });
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const openDesign = async (card: Card, side: 'front' | 'back') => {
    try {
      const res = await adminApi.get(`/gift-cards/${card.id}/design?side=${side}`, { responseType: 'text' });
      setDesign({ card, side, svg: res.data });
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const downloadDesign = async (card: Card, side: 'front' | 'back') => {
    try {
      const res = await adminApi.get(`/gift-cards/${card.id}/design?side=${side}&format=download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `giftcard-${card.code}-${side}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const toggle = async (card: Card) => {
    try {
      const res = await adminApi.patch(`/gift-cards/${card.id}/toggle`);
      toast.success(res.data.message);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const saveAdjust = async () => {
    if (!adjust.card) return;
    setSaving(true);
    try {
      await adminApi.post(`/gift-cards/${adjust.card.id}/adjust`, {
        type: adjust.type,
        amount: Number(adjust.amount),
        note: adjust.note || undefined,
      });
      toast.success('ব্যালেন্স আপডেট হয়েছে');
      setAdjust({ card: null, type: 'credit', amount: '', note: '' });
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await adminApi.delete(`/gift-cards/${deleting.id}`);
      toast.success('গিফট কার্ড মুছে ফেলা হয়েছে');
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="গিফট কার্ড"
        subtitle="ইস্যু, ব্যালেন্স ও স্ক্যানযোগ্য ডিজাইন"
        actions={can('giftcards:write') ? <Button icon={Plus} onClick={() => { setForm({ amount: '500', quantity: '1', design: 'classic', expiresAt: '', recipientName: '', recipientPhone: '', message: '' }); setCreateOpen(true); }}>নতুন গিফট কার্ড</Button> : undefined}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="মোট কার্ড" value={number(summary.cards)} icon={Gift} />
        <StatCard label="সক্রিয় কার্ড (এই পেজে)" value={number(cards.filter((c) => c.isActive).length)} icon={Power} tone="green" />
        <StatCard label="অবশিষ্ট ব্যালেন্স (সব)" value={taka(summary.outstanding)} icon={Wallet} tone="blue" />
      </div>

      <Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={STATUS_TABS} className="mb-3" />

      <Toolbar>
        <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1); }} className="flex overflow-hidden rounded-lg border border-gray-300 bg-white">
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="কোড বা প্রাপক…" className="h-9 w-52 px-3 text-sm outline-none" aria-label="গিফট কার্ড খুঁজুন" />
          <button type="submit" className="bg-gray-100 px-3 text-gray-600 hover:bg-gray-200" aria-label="খুঁজুন"><Search className="h-4 w-4" /></button>
        </form>
      </Toolbar>

      {loading ? <PageSpinner /> : cards.length === 0 ? (
        <EmptyState icon={Gift} title="কোনো গিফট কার্ড নেই" description="নতুন গিফট কার্ড ইস্যু করুন।" />
      ) : (
        <div className="card overflow-x-auto">
          <Table>
            <Thead><tr><Th>কোড</Th><Th>প্রাপক</Th><Th className="text-right">ব্যালেন্স</Th><Th>স্ট্যাটাস</Th><Th>মেয়াদ</Th><Th className="text-right">অ্যাকশন</Th></tr></Thead>
            <Tbody>
              {cards.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <Td>
                    <p className="font-mono font-semibold text-brand-700">{c.code}</p>
                    <p className="text-[11px] text-gray-400">{c.design} · {dateTime(c.createdAt)}</p>
                  </Td>
                  <Td className="text-xs">{c.recipientName || '—'}{c.recipientPhone && <p className="text-gray-500">{c.recipientPhone}</p>}</Td>
                  <Td className="text-right">
                    <p className="font-semibold tnum">{taka(c.remainingAmount)}</p>
                    <p className="text-[11px] text-gray-400 tnum">/ {taka(c.initialAmount)}</p>
                  </Td>
                  <Td><Badge tone={c.isActive ? 'green' : c.remainingAmount <= 0 ? 'gray' : 'red'}>{c.isActive ? 'সক্রিয়' : c.remainingAmount <= 0 ? 'ব্যবহৃত' : 'নিষ্ক্রিয়'}</Badge></Td>
                  <Td className="text-xs text-gray-600">{c.expiresAt ? dateOnly(c.expiresAt) : 'মেয়াদ নেই'}</Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openLedger(c.id)} className="rounded p-1.5 text-gray-500 hover:bg-brand-50 hover:text-brand-600" aria-label="লেজার"><Eye className="h-4 w-4" /></button>
                      <button onClick={() => openDesign(c, 'front')} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 text-xs" aria-label="সামনের ডিজাইন">F</button>
                      <button onClick={() => openDesign(c, 'back')} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 text-xs" aria-label="পেছনের ডিজাইন">B</button>
                      {can('giftcards:write') && (
                        <>
                          <button onClick={() => setAdjust({ card: c, type: 'credit', amount: '', note: '' })} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 text-xs" aria-label="ব্যালেন্স সমন্বয়">৳</button>
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

      {/* Create */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="নতুন গিফট কার্ড ইস্যু"
        footer={<><Button variant="ghost" onClick={() => setCreateOpen(false)}>বাতিল</Button><Button loading={saving} onClick={create}>তৈরি করুন</Button></>}
      >
        {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="পরিমাণ (৳)" requiredMark type="number" min={1} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          <Input label="সংখ্যা" type="number" min={1} max={50} value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
          <Select label="ডিজাইন" value={form.design} onChange={(e) => setForm((f) => ({ ...f, design: e.target.value }))} options={[
            { value: 'classic', label: 'ক্লাসিক' }, { value: 'festival', label: 'উৎসব' }, { value: 'premium', label: 'প্রিমিয়াম' }, { value: 'eid', label: 'ঈদ' },
          ]} />
          <Input label="মেয়াদ শেষ" type="date" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))} />
          <Input label="প্রাপকের নাম" value={form.recipientName} onChange={(e) => setForm((f) => ({ ...f, recipientName: e.target.value }))} />
          <Input label="প্রাপকের মোবাইল" value={form.recipientPhone} onChange={(e) => setForm((f) => ({ ...f, recipientPhone: e.target.value }))} />
          <div className="sm:col-span-2"><Textarea label="বার্তা" rows={2} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} /></div>
        </div>
      </Modal>

      {/* Created codes */}
      <Modal open={Boolean(created)} onClose={() => setCreated(null)} title="তৈরি করা কোডগুলো" footer={<Button onClick={() => setCreated(null)}>ঠিক আছে</Button>}>
        <p className="mb-2 text-xs text-gray-500">প্রতিটি কোড ইউনিক — প্রিন্ট করে গ্রাহককে দেওয়া যাবে।</p>
        <ul className="space-y-1">
          {created?.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
              <span className="font-mono text-sm font-semibold text-brand-700">{c.code}</span>
              <span className="text-xs tnum">{taka(c.remainingAmount)}</span>
              <div className="flex gap-1">
                <Button size="xs" variant="ghost" onClick={() => openDesign(c, 'front')}>সামনে</Button>
                <Button size="xs" variant="ghost" onClick={() => openDesign(c, 'back')}>পেছনে</Button>
              </div>
            </li>
          ))}
        </ul>
      </Modal>

      {/* Ledger */}
      <Modal open={Boolean(ledger)} onClose={() => setLedger(null)} title={ledger ? `লেজার — ${ledger.card.code}` : ''} size="lg">
        {ledger && (
          <div>
            <div className="mb-3 grid gap-2 rounded-lg bg-gray-50 p-3 text-sm sm:grid-cols-3">
              <p>প্রারম্ভিক: <span className="font-semibold tnum">{taka(ledger.card.initialAmount)}</span></p>
              <p>অবশিষ্ট: <span className="font-semibold tnum">{taka(ledger.card.remainingAmount)}</span></p>
              <p>স্ট্যাটাস: <Badge tone={ledger.card.isActive ? 'green' : 'gray'}>{ledger.card.status}</Badge></p>
            </div>
            {ledger.transactions.length === 0 ? <p className="text-sm text-gray-500">কোনো লেনদেন নেই।</p> : (
              <Table>
                <Thead><tr><Th>ধরন</Th><Th className="text-right">পরিমাণ</Th><Th className="text-right">ব্যালেন্স</Th><Th>নোট</Th><Th>সময়</Th></tr></Thead>
                <Tbody>
                  {ledger.transactions.map((t) => (
                    <tr key={t.id}>
                      <Td className="text-xs">{t.type}</Td>
                      <Td className={`text-right font-semibold tnum ${t.type === 'credit' || t.type === 'issue' ? 'text-emerald-600' : 'text-red-600'}`}>{taka(t.amount)}</Td>
                      <Td className="text-right tnum">{taka(t.balanceAfter)}</Td>
                      <Td className="text-xs text-gray-600">{t.note ?? '—'}</Td>
                      <Td className="text-xs text-gray-400">{dateTime(t.createdAt)}</Td>
                    </tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </div>
        )}
      </Modal>

      {/* Adjust */}
      <Modal
        open={Boolean(adjust.card)}
        onClose={() => setAdjust({ card: null, type: 'credit', amount: '', note: '' })}
        title="ব্যালেন্স সমন্বয়"
        footer={<><Button variant="ghost" onClick={() => setAdjust({ card: null, type: 'credit', amount: '', note: '' })}>বাতিল</Button><Button loading={saving} onClick={saveAdjust}>সংরক্ষণ</Button></>}
      >
        <p className="mb-3 text-sm text-gray-600">{adjust.card?.code} — বর্তমান ব্যালেন্স <span className="font-semibold tnum">{taka(adjust.card?.remainingAmount ?? 0)}</span></p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="ধরন" value={adjust.type} onChange={(e) => setAdjust((a) => ({ ...a, type: e.target.value }))} options={[{ value: 'credit', label: 'যোগ (credit)' }, { value: 'debit', label: 'বিয়োগ (debit)' }]} />
          <Input label="পরিমাণ (৳)" type="number" min={1} value={adjust.amount} onChange={(e) => setAdjust((a) => ({ ...a, amount: e.target.value }))} />
          <div className="sm:col-span-2"><Input label="নোট" value={adjust.note} onChange={(e) => setAdjust((a) => ({ ...a, note: e.target.value }))} /></div>
        </div>
      </Modal>

      {/* Design */}
      <Modal open={Boolean(design)} onClose={() => setDesign(null)} title={design ? `${design.card.code} — ${design.side === 'front' ? 'সামনের' : 'পেছনের'} ডিজাইন` : ''} size="lg">
        {design && (
          <div>
            <div className="overflow-hidden rounded-lg border border-gray-200" dangerouslySetInnerHTML={{ __html: design.svg }} />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" onClick={() => openDesign(design.card, design.side === 'front' ? 'back' : 'front')}>
                {design.side === 'front' ? 'পেছনের দিক' : 'সামনের দিক'}
              </Button>
              <Button icon={Download} onClick={() => downloadDesign(design.card, design.side)}>PNG ডাউনলোড</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={Boolean(deleting)} title="গিফট কার্ড মুছে ফেলবেন?" message={`${deleting?.code} মুছে ফেলা হবে।`} confirmLabel="মুছে ফেলুন" onCancel={() => setDeleting(null)} onConfirm={remove} />
    </div>
  );
}
