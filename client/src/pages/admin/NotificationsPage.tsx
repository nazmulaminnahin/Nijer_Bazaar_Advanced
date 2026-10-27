import { useCallback, useEffect, useState } from 'react';
import { Bell, Send, RefreshCw, Mail, MessageSquare, Smartphone, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { adminApi, getApiErrorMessage } from '@/lib/api';
import { number, dateTime } from '@/lib/format';
import { useAdmin } from '@/store/admin';
import { toast } from '@/lib/toast';
import {
  Badge, Button, EmptyState, Input, Modal, Pagination, Select, StatCard, Table, Tbody, Td, Th, Thead, Tabs, Textarea, PageSpinner, Card,
} from '@/components/admin/ui';
import { PageHeader } from '@/components/layout/AdminLayout';

interface Provider { channel: string; configured: boolean; enabled: boolean; name?: string; hint?: string; missing?: string[] }
interface LogRow {
  id: number; channel: string; recipient: string; subject?: string | null; body?: string | null;
  status: string; error?: string | null; createdAt: string; sentAt?: string | null;
}
interface Template { id: number; name: string; channel: string; event?: string | null; subject?: string | null; body: string; isActive: boolean }

const CHANNEL_ICON: Record<string, React.ElementType> = { email: Mail, sms: Smartphone, whatsapp: MessageSquare, push: Bell };
const CHANNEL_LABEL: Record<string, string> = { email: 'ইমেইল', sms: 'এসএমএস', whatsapp: 'হোয়াটসঅ্যাপ', push: 'পুশ', in_app: 'ইন-অ্যাপ' };

export default function NotificationsPage() {
  const can = useAdmin((s) => s.can);
  const [tab, setTab] = useState<'providers' | 'logs' | 'templates'>('providers');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [stats, setStats] = useState<{ sent?: number; failed?: number; pending?: number; total?: number }>({});
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const [testOpen, setTestOpen] = useState<Provider | null>(null);
  const [testForm, setTestForm] = useState({ to: '', message: '' });
  const [testResult, setTestResult] = useState<string>('');
  const [sending, setSending] = useState(false);

  const [tplOpen, setTplOpen] = useState(false);
  const [tplForm, setTplForm] = useState({ name: '', channel: 'email', event: '', subject: '', body: '' });
  const [saving, setSaving] = useState(false);

  const loadProviders = useCallback(() => {
    setLoading(true);
    adminApi.get('/admin/notifications/providers')
      .then((res) => setProviders(res.data.providers ?? []))
      .catch((err) => toast.error(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
    adminApi.get('/admin/notifications/stats').then((res) => setStats(res.data.stats ?? {})).catch(() => undefined);
  }, []);

  const loadLogs = useCallback(() => {
    setLoading(true);
    adminApi.get(`/admin/notifications/logs?page=${page}&limit=25&status=${statusFilter}`)
      .then((res) => {
        setLogs(res.data.logs ?? []);
        setStats(res.data.stats ?? {});
        setPagination({ page: res.data.pagination?.page ?? 1, totalPages: res.data.pagination?.totalPages ?? 1, total: res.data.total ?? 0 });
      })
      .catch((err) => toast.error(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [page, statusFilter]);

  const loadTemplates = useCallback(() => {
    setLoading(true);
    adminApi.get('/admin/notifications/templates')
      .then((res) => setTemplates(res.data.templates ?? []))
      .catch((err) => toast.error(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadProviders(); }, [loadProviders]);
  useEffect(() => { if (tab === 'logs') loadLogs(); if (tab === 'templates') loadTemplates(); }, [tab, loadLogs, loadTemplates]);

  const sendTest = async () => {
    if (!testOpen) return;
    setSending(true);
    setTestResult('');
    try {
      const res = await adminApi.post('/admin/notifications/test', { channel: testOpen.channel, to: testForm.to, message: testForm.message || undefined });
      setTestResult(`সফল: ${res.data.message ?? 'মেসেজ পাঠানো হয়েছে'}`);
      toast.success('টেস্ট মেসেজ পাঠানো হয়েছে');
      loadLogs();
    } catch (err: any) {
      const data = err?.response?.data;
      setTestResult(data?.configured === false
        ? `কনফিগার করা নেই: ${data.message} ${data.hint ?? ''}`
        : getApiErrorMessage(err));
      toast.error(getApiErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const retry = async (id: number) => {
    try {
      await adminApi.post(`/admin/notifications/logs/${id}/retry`);
      toast.success('আবার পাঠানো হয়েছে');
      loadLogs();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const saveTemplate = async () => {
    setSaving(true);
    try {
      await adminApi.post('/admin/notifications/templates', tplForm);
      toast.success('টেমপ্লেট সংরক্ষণ হয়েছে');
      setTplOpen(false);
      setTplForm({ name: '', channel: 'email', event: '', subject: '', body: '' });
      loadTemplates();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="নোটিফিকেশন"
        subtitle="প্রোভাইডার অবস্থা, ডেলিভারি লগ ও টেমপ্লেট — কোনো ভুয়া 'পাঠানো হয়েছে' নেই"
        actions={<Button variant="outline" icon={RefreshCw} onClick={() => { loadProviders(); if (tab === 'logs') loadLogs(); if (tab === 'templates') loadTemplates(); }}>রিফ্রেশ</Button>}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="মোট মেসেজ" value={number(stats.total ?? 0)} icon={Bell} />
        <StatCard label="পাঠানো" value={number(stats.sent ?? 0)} icon={CheckCircle2} tone="green" />
        <StatCard label="ব্যর্থ" value={number(stats.failed ?? 0)} icon={XCircle} tone="red" />
        <StatCard label="পেন্ডিং" value={number(stats.pending ?? 0)} icon={AlertTriangle} tone="amber" />
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'providers', label: 'প্রোভাইডার' },
        { value: 'logs', label: 'ডেলিভারি লগ' },
        { value: 'templates', label: 'টেমপ্লেট' },
      ]} className="mb-3" />

      {tab === 'providers' && (
        loading ? <PageSpinner /> : (
          <div className="grid gap-3 sm:grid-cols-2">
            {providers.map((p) => {
              const Icon = CHANNEL_ICON[p.channel] ?? Bell;
              return (
                <Card key={p.channel} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Icon className="h-4 w-4" /></span>
                      <div>
                        <p className="text-sm font-semibold text-ink-900">{CHANNEL_LABEL[p.channel] ?? p.channel}</p>
                        <p className="text-[11px] text-gray-500">{p.name ?? 'প্রোভাইডার'}</p>
                      </div>
                    </div>
                    <Badge tone={p.configured ? 'green' : 'amber'}>{p.configured ? 'কনফিগার করা আছে' : 'কনফিগার করা নেই'}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-gray-600">
                    {p.configured
                      ? `সার্ভারে ক্রেডেনশিয়াল আছে${p.enabled ? ' এবং চালু আছে' : ' কিন্তু সেটিংসে বন্ধ আছে'}।`
                      : `প্রয়োজনীয় এনভায়রনমেন্ট ভেরিয়েবল নেই${p.missing?.length ? `: ${p.missing.join(', ')}` : ''}।`}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" icon={Send} onClick={() => { setTestOpen(p); setTestForm({ to: '', message: '' }); setTestResult(''); }} disabled={!can('notifications:write')}>টেস্ট পাঠান</Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      )}

      {tab === 'logs' && (
        <>
          <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} options={[
            { value: 'all', label: 'সব স্ট্যাটাস' }, { value: 'sent', label: 'পাঠানো' }, { value: 'failed', label: 'ব্যর্থ' }, { value: 'pending', label: 'পেন্ডিং' },
          ]} className="mb-3 h-9 w-44" aria-label="স্ট্যাটাস ফিল্টার" />
          {loading ? <PageSpinner /> : logs.length === 0 ? (
            <EmptyState title="কোনো লগ নেই" description="নোটিফিকেশন পাঠানো হলে এখানে রেকর্ড হবে।" />
          ) : (
            <div className="card overflow-x-auto">
              <Table>
                <Thead><tr><Th>চ্যানেল</Th><Th>প্রাপক</Th><Th>বিষয় / বার্তা</Th><Th>স্ট্যাটাস</Th><Th>সময়</Th><Th className="text-right">অ্যাকশন</Th></tr></Thead>
                <Tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <Td className="text-xs">{CHANNEL_LABEL[l.channel] ?? l.channel}</Td>
                      <Td className="text-xs font-mono">{l.recipient}</Td>
                      <Td className="max-w-[280px] truncate text-xs">{l.subject || l.body || '—'}{l.error && <p className="truncate text-[11px] text-red-500">{l.error}</p>}</Td>
                      <Td><Badge tone={l.status === 'sent' ? 'green' : l.status === 'failed' ? 'red' : 'amber'}>{l.status}</Badge></Td>
                      <Td className="text-xs text-gray-500">{dateTime(l.createdAt)}</Td>
                      <Td className="text-right">
                        {l.status !== 'sent' && can('notifications:write') && (
                          <Button size="xs" variant="outline" onClick={() => retry(l.id)}>আবার পাঠান</Button>
                        )}
                      </Td>
                    </tr>
                  ))}
                </Tbody>
              </Table>
            </div>
          )}
          <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={25} onChange={setPage} />
        </>
      )}

      {tab === 'templates' && (
        <>
          <div className="mb-3 flex justify-end">
            {can('notifications:write') && <Button icon={Send} onClick={() => setTplOpen(true)}>নতুন টেমপ্লেট</Button>}
          </div>
          {loading ? <PageSpinner /> : templates.length === 0 ? (
            <EmptyState title="কোনো টেমপ্লেট নেই" description="ইমেইল/এসএমএস টেমপ্লেট তৈরি করুন।" />
          ) : (
            <div className="card overflow-x-auto">
              <Table>
                <Thead><tr><Th>নাম</Th><Th>চ্যানেল</Th><Th>ইভেন্ট</Th><Th>বিষয়</Th><Th>স্ট্যাটাস</Th></tr></Thead>
                <Tbody>
                  {templates.map((t) => (
                    <tr key={t.id}>
                      <Td className="font-medium">{t.name}</Td>
                      <Td className="text-xs">{CHANNEL_LABEL[t.channel] ?? t.channel}</Td>
                      <Td className="text-xs text-gray-500">{t.event ?? '—'}</Td>
                      <Td className="max-w-[240px] truncate text-xs">{t.subject ?? t.body}</Td>
                      <Td><Badge tone={t.isActive ? 'green' : 'gray'}>{t.isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</Badge></Td>
                    </tr>
                  ))}
                </Tbody>
              </Table>
            </div>
          )}
        </>
      )}

      <Modal
        open={Boolean(testOpen)}
        onClose={() => setTestOpen(null)}
        title={`টেস্ট মেসেজ — ${testOpen ? CHANNEL_LABEL[testOpen.channel] ?? testOpen.channel : ''}`}
        footer={<><Button variant="ghost" onClick={() => setTestOpen(null)}>বন্ধ</Button><Button loading={sending} onClick={sendTest} disabled={!testOpen?.configured}>পাঠান</Button></>}
      >
        {!testOpen?.configured && (
          <div className="mb-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            এই চ্যানেল কনফিগার করা নেই, তাই মেসেজ পাঠানো সম্ভব নয়। সার্ভারের .env এ প্রয়োজনীয় ভেরিয়েবল যোগ করুন — কোনো ভুয়া “পাঠানো হয়েছে” দেখানো হবে না।
          </div>
        )}
        <div className="space-y-3">
          <Input label="প্রাপক" requiredMark value={testForm.to} onChange={(e) => setTestForm((f) => ({ ...f, to: e.target.value }))} placeholder={testOpen?.channel === 'email' ? 'you@example.com' : '01XXXXXXXXX'} />
          <Textarea label="বার্তা" rows={3} value={testForm.message} onChange={(e) => setTestForm((f) => ({ ...f, message: e.target.value }))} placeholder="টেস্ট বার্তা (ঐচ্ছিক)" />
          {testResult && <p className="rounded-lg bg-gray-50 p-2 text-xs text-gray-700">{testResult}</p>}
        </div>
      </Modal>

      <Modal
        open={tplOpen}
        onClose={() => setTplOpen(false)}
        title="নতুন টেমপ্লেট"
        footer={<><Button variant="ghost" onClick={() => setTplOpen(false)}>বাতিল</Button><Button loading={saving} onClick={saveTemplate}>সংরক্ষণ</Button></>}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="নাম" requiredMark value={tplForm.name} onChange={(e) => setTplForm((f) => ({ ...f, name: e.target.value }))} />
          <Select label="চ্যানেল" value={tplForm.channel} onChange={(e) => setTplForm((f) => ({ ...f, channel: e.target.value }))} options={[
            { value: 'email', label: 'ইমেইল' }, { value: 'sms', label: 'এসএমএস' }, { value: 'whatsapp', label: 'হোয়াটসঅ্যাপ' }, { value: 'in_app', label: 'ইন-অ্যাপ' },
          ]} />
          <Input label="ইভেন্ট" value={tplForm.event} onChange={(e) => setTplForm((f) => ({ ...f, event: e.target.value }))} hint="যেমন order_confirmed" />
          <Input label="বিষয়" value={tplForm.subject} onChange={(e) => setTplForm((f) => ({ ...f, subject: e.target.value }))} />
          <div className="sm:col-span-2"><Textarea label="বার্তা" requiredMark rows={4} value={tplForm.body} onChange={(e) => setTplForm((f) => ({ ...f, body: e.target.value }))} hint="{{name}}, {{orderNumber}} প্লেসহোল্ডার ব্যবহার করা যাবে" /></div>
        </div>
      </Modal>
    </div>
  );
}
