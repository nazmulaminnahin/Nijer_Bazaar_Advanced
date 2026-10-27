import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Eye, MessageSquarePlus, Ban, CheckCircle2, Phone, Mail, Users, MailOpen, X } from 'lucide-react';
import { adminApi, getApiErrorMessage } from '@/lib/api';
import { taka, number, dateTime, orderStatusLabel, orderStatusTone } from '@/lib/format';
import { useAdmin } from '@/store/admin';
import { toast } from '@/lib/toast';
import {
  Badge, Button, EmptyState, Modal, Pagination, StatCard, Table, Tbody, Td, Th, Thead, Textarea, Toolbar, PageSpinner, Tabs,
} from '@/components/admin/ui';
import { PageHeader } from '@/components/layout/AdminLayout';

interface Customer {
  serial: number; id: number; name: string; phone: string; email: string; isActive: boolean;
  loyaltyPoints: number; orderCount: number; totalSpent: number; lastOrderAt: string | null; createdAt: string;
}
interface Note { id: number; note: string; type: string; createdAt: string }
interface Detail extends Customer {
  orders: Array<{ id: number; orderNumber: string; total: number; status: string; createdAt: string }>;
  notes: Note[];
}
interface ContactMessage {
  id: number; name: string; phone: string; email?: string | null; subject?: string | null;
  message: string; status: string; adminNote?: string | null; createdAt: string;
}

const CONTACT_STATUS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'সব বার্তা' },
  { value: 'new', label: 'নতুন' },
  { value: 'read', label: 'পঠিত' },
  { value: 'replied', label: 'উত্তর দেওয়া' },
  { value: 'closed', label: 'বন্ধ' },
];

export default function CustomersPage() {
  const can = useAdmin((s) => s.can);
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') ?? 'customers') as 'customers' | 'messages';
  const page = Number(params.get('page') ?? 1);
  const search = params.get('search') ?? '';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [columns, setColumns] = useState<string[]>(['ক্রমিক নং', 'কাস্টমারের নাম', 'মোবাইল নাম্বার', 'ইমেইল']);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(search);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [messageStatus, setMessageStatus] = useState('all');
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [activeMessage, setActiveMessage] = useState<ContactMessage | null>(null);
  const [messageNote, setMessageNote] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) q.set('search', search);
    adminApi.get(`/admin/customers?${q.toString()}`)
      .then((res) => {
        setCustomers(res.data.customers ?? []);
        setColumns(res.data.columns ?? columns);
        setPagination({ page: res.data.pagination?.page ?? 1, totalPages: res.data.pagination?.totalPages ?? 1, total: res.data.pagination?.total ?? 0 });
      })
      .catch((err) => toast.error(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  const loadMessages = useCallback(() => {
    setMessagesLoading(true);
    adminApi.get(`/admin/contact-messages?status=${messageStatus}&limit=50`)
      .then((res) => {
        setMessages(res.data.messages ?? []);
        setNewMessageCount(res.data.counts?.new ?? 0);
      })
      .catch((err) => toast.error(getApiErrorMessage(err)))
      .finally(() => setMessagesLoading(false));
  }, [messageStatus]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadMessages(); }, [loadMessages]);

  const openDetail = async (id: number) => {
    try {
      const res = await adminApi.get(`/admin/customers/${id}`);
      setDetail(res.data.customer);
      setNote('');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const addNote = async () => {
    if (!detail || note.trim().length < 2) { toast.error('নোট লিখুন'); return; }
    setBusy(true);
    try {
      await adminApi.post(`/admin/customers/${detail.id}/notes`, { note: note.trim() });
      toast.success('নোট সংরক্ষণ হয়েছে');
      setNote('');
      const res = await adminApi.get(`/admin/customers/${detail.id}`);
      setDetail(res.data.customer);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (c: { id: number; isActive: boolean; name: string }) => {
    try {
      await adminApi.patch(`/admin/customers/${c.id}/status`, { isActive: !c.isActive });
      toast.success(c.isActive ? 'অ্যাকাউন্ট নিষ্ক্রিয় করা হয়েছে' : 'অ্যাকাউন্ট সক্রিয় করা হয়েছে');
      setCustomers((list) => list.map((x) => (x.id === c.id ? { ...x, isActive: !x.isActive } : x)));
      if (detail?.id === c.id) setDetail({ ...detail, isActive: !c.isActive });
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const updateMessage = async (id: number, patch: { status?: string; adminNote?: string }) => {
    try {
      await adminApi.patch(`/admin/contact-messages/${id}`, patch);
      toast.success('আপডেট হয়েছে');
      loadMessages();
      setActiveMessage(null);
      setMessageNote('');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const totalSpent = customers.reduce((s, c) => s + c.totalSpent, 0);

  return (
    <div>
      <PageHeader
        title="কাস্টমার ম্যানেজমেন্ট"
        subtitle="গ্রাহক তালিকা, CRM নোট ও যোগাযোগ বার্তা"
        actions={can('customers:write') ? undefined : undefined}
      />

      <Tabs
        value={tab}
        onChange={(v) => setParams(v === 'customers' ? {} : { tab: v }, { replace: true })}
        tabs={[
          { value: 'customers', label: 'কাস্টমার তালিকা', count: pagination.total },
          { value: 'messages', label: 'যোগাযোগ বার্তা', count: newMessageCount },
        ]}
        className="mb-3"
      />

      {tab === 'customers' ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard label="মোট কাস্টমার" value={number(pagination.total)} icon={Users} />
            <StatCard label="এই পেজে মোট ক্রয়" value={taka(totalSpent)} icon={Users} tone="green" />
            <StatCard label="সক্রিয় (এই পেজে)" value={number(customers.filter((c) => c.isActive).length)} icon={CheckCircle2} tone="blue" />
          </div>

          <Toolbar>
            <form onSubmit={(e) => { e.preventDefault(); setParams(searchInput ? { search: searchInput } : {}, { replace: true }); }} className="flex overflow-hidden rounded-lg border border-gray-300 bg-white">
              <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="নাম, মোবাইল, ইমেইল…" className="h-9 w-56 px-3 text-sm outline-none" aria-label="কাস্টমার খুঁজুন" />
              <button type="submit" className="bg-gray-100 px-3 text-gray-600 hover:bg-gray-200" aria-label="খুঁজুন"><Search className="h-4 w-4" /></button>
            </form>
            {search && <Button variant="ghost" size="sm" icon={X} onClick={() => { setSearchInput(''); setParams({}, { replace: true }); }}>মুছুন</Button>}
          </Toolbar>

          {loading ? <PageSpinner /> : customers.length === 0 ? (
            <EmptyState title="কোনো কাস্টমার নেই" description="নতুন রেজিস্ট্রেশন এলে এখানে দেখা যাবে।" />
          ) : (
            <div className="card overflow-x-auto">
              <Table>
                <Thead>
                  <tr>
                    <Th>{columns[0] ?? 'ক্রমিক নং'}</Th>
                    <Th>{columns[1] ?? 'কাস্টমারের নাম'}</Th>
                    <Th>{columns[2] ?? 'মোবাইল নাম্বার'}</Th>
                    <Th>{columns[3] ?? 'ইমেইল'}</Th>
                    <Th className="text-right">অর্ডার</Th>
                    <Th className="text-right">মোট ক্রয়</Th>
                    <Th>স্ট্যাটাস</Th>
                    <Th className="text-right">অ্যাকশন</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <Td className="tnum text-gray-500">{c.serial}</Td>
                      <Td>
                        <p className="font-medium text-ink-900">{c.name}</p>
                        <p className="text-[11px] text-gray-400">যোগদান: {dateTime(c.createdAt)}</p>
                      </Td>
                      <Td className="font-mono text-xs">{c.phone || '—'}</Td>
                      <Td className="text-xs">{c.email || '—'}</Td>
                      <Td className="text-right tnum">{c.orderCount}</Td>
                      <Td className="text-right font-semibold tnum">{taka(c.totalSpent)}</Td>
                      <Td><Badge tone={c.isActive ? 'green' : 'red'}>{c.isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</Badge></Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openDetail(c.id)} className="rounded p-1.5 text-gray-500 hover:bg-brand-50 hover:text-brand-600" aria-label="বিস্তারিত"><Eye className="h-4 w-4" /></button>
                          {can('customers:write') && (
                            <button onClick={() => toggleStatus(c)} className={`rounded p-1.5 hover:bg-gray-100 ${c.isActive ? 'text-gray-500 hover:text-red-600' : 'text-emerald-600'}`} aria-label={c.isActive ? 'নিষ্ক্রিয় করুন' : 'সক্রিয় করুন'}>
                              {c.isActive ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                            </button>
                          )}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </Tbody>
              </Table>
            </div>
          )}

          <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={20} onChange={(p) => setParams({ page: String(p), ...(search ? { search } : {}) }, { replace: true })} />
        </>
      ) : (
        <>
          <Tabs value={messageStatus} onChange={setMessageStatus} tabs={CONTACT_STATUS} className="mb-3" />
          {messagesLoading ? <PageSpinner /> : messages.length === 0 ? (
            <EmptyState icon={MailOpen} title="কোনো বার্তা নেই" description="ওয়েবসাইটের যোগাযোগ ফর্ম থেকে আসা বার্তা এখানে দেখা যাবে।" />
          ) : (
            <div className="space-y-2">
              {messages.map((m) => (
                <div key={m.id} className="card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-ink-900">{m.name} <span className="font-mono text-xs font-normal text-gray-500">{m.phone}</span></p>
                      {m.subject && <p className="text-xs text-gray-600">বিষয়: {m.subject}</p>}
                      <p className="mt-1 text-sm text-gray-700">{m.message}</p>
                      {m.adminNote && <p className="mt-1 rounded bg-gray-50 p-2 text-xs text-gray-600">অ্যাডমিন নোট: {m.adminNote}</p>}
                    </div>
                    <div className="text-right">
                      <Badge tone={m.status === 'new' ? 'amber' : m.status === 'closed' ? 'gray' : 'green'}>{CONTACT_STATUS.find((s) => s.value === m.status)?.label ?? m.status}</Badge>
                      <p className="mt-1 text-[11px] text-gray-400">{dateTime(m.createdAt)}</p>
                    </div>
                  </div>
                  {can('customers:write') && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Button size="xs" variant="outline" onClick={() => updateMessage(m.id, { status: 'read' })}>পঠিত</Button>
                      <Button size="xs" variant="outline" onClick={() => updateMessage(m.id, { status: 'replied' })}>উত্তর দেওয়া</Button>
                      <Button size="xs" variant="ghost" icon={MessageSquarePlus} onClick={() => { setActiveMessage(m); setMessageNote(m.adminNote ?? ''); }}>নোট</Button>
                      <Button size="xs" variant="ghost" onClick={() => updateMessage(m.id, { status: 'closed' })}>বন্ধ</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detail ? detail.name : ''} size="lg">
        {detail && (
          <div className="space-y-4">
            <div className="grid gap-2 rounded-lg bg-gray-50 p-3 text-sm sm:grid-cols-2">
              <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-brand-600" /> {detail.phone || '—'}</p>
              <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-brand-600" /> {detail.email || '—'}</p>
              <p>লয়্যালটি পয়েন্ট: <span className="font-semibold">{detail.loyaltyPoints}</span></p>
              <p>স্ট্যাটাস: <Badge tone={detail.isActive ? 'green' : 'red'}>{detail.isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</Badge></p>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-gray-500">অর্ডার ({detail.orders.length})</p>
              {detail.orders.length === 0 ? <p className="text-sm text-gray-500">কোনো অর্ডার নেই।</p> : (
                <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                  {detail.orders.map((o) => (
                    <div key={o.id} className="flex items-center justify-between p-2.5 text-sm">
                      <span className="font-medium">{o.orderNumber}</span>
                      <Badge tone={orderStatusTone(o.status)}>{orderStatusLabel(o.status)}</Badge>
                      <span className="tnum">{taka(o.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-gray-500">CRM নোট ({detail.notes.length})</p>
              {detail.notes.length === 0 ? <p className="text-sm text-gray-500">কোনো নোট নেই।</p> : (
                <ul className="space-y-1.5">
                  {detail.notes.map((n) => (
                    <li key={n.id} className="rounded-lg bg-gray-50 p-2 text-sm">
                      {n.note}
                      <span className="ml-2 text-[11px] text-gray-400">{dateTime(n.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {can('customers:write') && (
                <div className="mt-2 flex gap-2">
                  <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="নতুন নোট…" />
                  <Button loading={busy} onClick={addNote}>যোগ করুন</Button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(activeMessage)}
        onClose={() => setActiveMessage(null)}
        title="বার্তার নোট"
        footer={<><Button variant="ghost" onClick={() => setActiveMessage(null)}>বাতিল</Button><Button onClick={() => activeMessage && updateMessage(activeMessage.id, { adminNote: messageNote, status: 'read' })}>সংরক্ষণ</Button></>}
      >
        <p className="mb-2 text-sm text-gray-600">{activeMessage?.message}</p>
        <Textarea label="অ্যাডমিন নোট" rows={3} value={messageNote} onChange={(e) => setMessageNote(e.target.value)} />
      </Modal>
    </div>
  );
}
