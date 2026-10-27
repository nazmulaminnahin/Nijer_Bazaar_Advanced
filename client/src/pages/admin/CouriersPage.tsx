import { useCallback, useEffect, useState } from 'react';
import { Plus, Truck, Pencil, Trash2, Phone } from 'lucide-react';
import { adminApi, getApiErrorMessage } from '@/lib/api';
import { useAdmin } from '@/store/admin';
import { toast } from '@/lib/toast';
import {
  Badge, Button, ConfirmDialog, EmptyState, Input, Modal, Switch, Table, Tbody, Td, Th, Thead, PageSpinner,
} from '@/components/admin/ui';
import { PageHeader } from '@/components/layout/AdminLayout';

interface Courier { id: number; name: string; phone?: string | null; website?: string | null; trackingUrl?: string | null; isActive: boolean; coverage?: string | null }

const empty = { name: '', phone: '', website: '', trackingUrl: '', coverage: '', isActive: true };

export default function CouriersPage() {
  const can = useAdmin((s) => s.can);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Courier | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<Courier | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.get('/admin/couriers')
      .then((res) => setCouriers(res.data.couriers ?? []))
      .catch((err) => toast.error(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (c: Courier) => {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone ?? '', website: c.website ?? '', trackingUrl: c.trackingUrl ?? '', coverage: c.coverage ?? '', isActive: c.isActive });
    setError('');
    setOpen(true);
  };

  const save = async () => {
    setError('');
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        phone: form.phone || undefined,
        website: form.website || undefined,
        trackingUrl: form.trackingUrl || undefined,
        coverage: form.coverage || undefined,
        isActive: form.isActive,
      };
      if (editing) { await adminApi.put(`/admin/couriers/${editing.id}`, payload); toast.success('কুরিয়ার আপডেট হয়েছে'); }
      else { await adminApi.post('/admin/couriers', payload); toast.success('কুরিয়ার যোগ হয়েছে'); }
      setOpen(false);
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
      await adminApi.delete(`/admin/couriers/${deleting.id}`);
      toast.success('কুরিয়ার মুছে ফেলা হয়েছে');
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="কুরিয়ার"
        subtitle="ডেলিভারি পার্টনার ও ট্র্যাকিং লিংক"
        actions={can('couriers:write') ? <Button icon={Plus} onClick={() => { setEditing(null); setForm({ ...empty }); setOpen(true); }}>নতুন কুরিয়ার</Button> : undefined}
      />

      {loading ? <PageSpinner /> : couriers.length === 0 ? (
        <EmptyState icon={Truck} title="কোনো কুরিয়ার নেই" description="পাঠাও, সুন্দরবন, রেডেক্স ইত্যাদি যোগ করুন।" />
      ) : (
        <div className="card overflow-x-auto">
          <Table>
            <Thead><tr><Th>নাম</Th><Th>ফোন</Th><Th>কভারেজ</Th><Th>ট্র্যাকিং লিংক</Th><Th>স্ট্যাটাস</Th><Th className="text-right">অ্যাকশন</Th></tr></Thead>
            <Tbody>
              {couriers.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <Td className="font-medium text-ink-900">{c.name}</Td>
                  <Td className="text-xs">{c.phone ? <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {c.phone}</span> : '—'}</Td>
                  <Td className="text-xs text-gray-600">{c.coverage || '—'}</Td>
                  <Td className="max-w-[200px] truncate text-xs text-brand-600">{c.trackingUrl || '—'}</Td>
                  <Td><Badge tone={c.isActive ? 'green' : 'gray'}>{c.isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</Badge></Td>
                  <Td className="text-right">
                    {can('couriers:write') && (
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(c)} className="rounded p-1.5 text-gray-500 hover:bg-brand-50 hover:text-brand-600" aria-label="সম্পাদনা"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => setDeleting(c)} className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600" aria-label="মুছুন"><Trash2 className="h-4 w-4" /></button>
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
        title={editing ? 'কুরিয়ার সম্পাদনা' : 'নতুন কুরিয়ার'}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>বাতিল</Button><Button loading={saving} onClick={save}>সংরক্ষণ</Button></>}
      >
        {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="নাম" requiredMark value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="ফোন" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <Input label="ওয়েবসাইট" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
          <Input label="ট্র্যাকিং URL" value={form.trackingUrl} onChange={(e) => setForm((f) => ({ ...f, trackingUrl: e.target.value }))} hint="যেমন https://track.pathao.com/" />
          <div className="sm:col-span-2"><Input label="কভারেজ" value={form.coverage} onChange={(e) => setForm((f) => ({ ...f, coverage: e.target.value }))} hint="যেমন: সারা বাংলাদেশ" /></div>
          <div className="sm:col-span-2"><Switch checked={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} label="সক্রিয়" /></div>
        </div>
      </Modal>

      <ConfirmDialog open={Boolean(deleting)} title="কুরিয়ার মুছে ফেলবেন?" message={`${deleting?.name} মুছে ফেলা হবে।`} confirmLabel="মুছে ফেলুন" onCancel={() => setDeleting(null)} onConfirm={remove} />
    </div>
  );
}
