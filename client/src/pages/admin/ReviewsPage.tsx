import { useCallback, useEffect, useState } from 'react';
import { Plus, Star, Trash2, Eye, EyeOff, Pencil } from 'lucide-react';
import { adminApi, getApiErrorMessage } from '@/lib/api';
import { dateOnly } from '@/lib/format';
import { useAdmin } from '@/store/admin';
import { toast } from '@/lib/toast';
import {
  Badge, Button, ConfirmDialog, EmptyState, Input, Modal, Select, Switch, Table, Tbody, Td, Th, Thead, Textarea, PageSpinner,
} from '@/components/admin/ui';
import { PageHeader } from '@/components/layout/AdminLayout';

interface Testimonial {
  id: number; name: string; location?: string | null; rating: number; message: string;
  isPublished: boolean; sortOrder: number; createdAt: string;
}

const empty = { name: '', location: '', rating: '5', message: '', isPublished: true, sortOrder: '0' };

export default function ReviewsPage() {
  const can = useAdmin((s) => s.can);
  const [rows, setRows] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<Testimonial | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.get('/admin/testimonials')
      .then((res) => setRows(res.data.testimonials ?? []))
      .catch((err) => toast.error(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm({ ...empty }); setError(''); setOpen(true); };
  const openEdit = (t: Testimonial) => {
    setEditing(t);
    setForm({ name: t.name, location: t.location ?? '', rating: String(t.rating), message: t.message, isPublished: t.isPublished, sortOrder: String(t.sortOrder) });
    setError('');
    setOpen(true);
  };

  const save = async () => {
    setError('');
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        location: form.location || null,
        rating: Number(form.rating),
        message: form.message.trim(),
        isPublished: form.isPublished,
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (editing) { await adminApi.put(`/admin/testimonials/${editing.id}`, payload); toast.success('আপডেট হয়েছে'); }
      else { await adminApi.post('/admin/testimonials', payload); toast.success('যোগ হয়েছে'); }
      setOpen(false);
      load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (t: Testimonial) => {
    try {
      await adminApi.patch(`/admin/testimonials/${t.id}/publish`, { isPublished: !t.isPublished });
      toast.success(t.isPublished ? 'আনপাবলিশ করা হয়েছে' : 'পাবলিশ করা হয়েছে');
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await adminApi.delete(`/admin/testimonials/${deleting.id}`);
      toast.success('মুছে ফেলা হয়েছে');
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="কাস্টমার রিভিউ / প্রশংসাপত্র"
        subtitle="শুধু পাবলিশ করা রিভিউ ওয়েবসাইটে দেখায় — কোনো বানানো রিভিউ নেই"
        actions={can('settings:write') ? <Button icon={Plus} onClick={openCreate}>নতুন যোগ করুন</Button> : undefined}
      />

      {loading ? <PageSpinner /> : rows.length === 0 ? (
        <EmptyState icon={Star} title="কোনো রিভিউ নেই" description="গ্রাহকের অনুমোদিত প্রশংসাপত্র যোগ করুন।" />
      ) : (
        <div className="card overflow-x-auto">
          <Table>
            <Thead><tr><Th>নাম</Th><Th>রেটিং</Th><Th>বার্তা</Th><Th>ক্রম</Th><Th>স্ট্যাটাস</Th><Th className="text-right">অ্যাকশন</Th></tr></Thead>
            <Tbody>
              {rows.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <Td><p className="font-medium text-ink-900">{t.name}</p><p className="text-[11px] text-gray-400">{t.location || '—'} · {dateOnly(t.createdAt)}</p></Td>
                  <Td className="text-xs">{'★'.repeat(t.rating)}<span className="text-gray-300">{'★'.repeat(5 - t.rating)}</span></Td>
                  <Td className="max-w-[320px] text-xs text-gray-600"><span className="line-clamp-2">{t.message}</span></Td>
                  <Td className="tnum">{t.sortOrder}</Td>
                  <Td><Badge tone={t.isPublished ? 'green' : 'gray'}>{t.isPublished ? 'প্রকাশিত' : 'অপ্রকাশিত'}</Badge></Td>
                  <Td className="text-right">
                    {can('settings:write') && (
                      <div className="flex justify-end gap-1">
                        <button onClick={() => togglePublish(t)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100" aria-label="পাবলিশ টগল">{t.isPublished ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                        <button onClick={() => openEdit(t)} className="rounded p-1.5 text-gray-500 hover:bg-brand-50 hover:text-brand-600" aria-label="সম্পাদনা"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => setDeleting(t)} className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600" aria-label="মুছুন"><Trash2 className="h-4 w-4" /></button>
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
        title={editing ? 'রিভিউ সম্পাদনা' : 'নতুন প্রশংসাপত্র'}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>বাতিল</Button><Button loading={saving} onClick={save}>সংরক্ষণ</Button></>}
      >
        {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="নাম" requiredMark value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="এলাকা" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
          <Select label="রেটিং" value={form.rating} onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))} options={[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} স্টার` }))} />
          <Input label="ক্রম" type="number" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))} />
          <div className="sm:col-span-2"><Textarea label="বার্তা" requiredMark rows={4} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} /></div>
          <div className="sm:col-span-2"><Switch checked={form.isPublished} onChange={(v) => setForm((f) => ({ ...f, isPublished: v }))} label="ওয়েবসাইটে প্রকাশ করুন" /></div>
        </div>
      </Modal>

      <ConfirmDialog open={Boolean(deleting)} title="রিভিউ মুছে ফেলবেন?" message={`${deleting?.name} এর রিভিউ মুছে ফেলা হবে।`} confirmLabel="মুছে ফেলুন" onCancel={() => setDeleting(null)} onConfirm={remove} />
    </div>
  );
}
