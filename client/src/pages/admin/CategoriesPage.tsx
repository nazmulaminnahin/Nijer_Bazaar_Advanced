import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, ImagePlus } from 'lucide-react';
import { adminApi, getApiErrorMessage, mediaUrl, uploadImage } from '@/lib/api';
import { useAdmin } from '@/store/admin';
import { toast } from '@/lib/toast';
import {
  Badge, Button, ConfirmDialog, EmptyState, Input, Modal, SmartImage, Switch, Table, Tbody, Td, Th, Thead, PageSpinner, Textarea,
} from '@/components/admin/ui';
import { PageHeader } from '@/components/layout/AdminLayout';

interface Category {
  id: number; name: string; nameBn?: string | null; slug: string; description?: string | null;
  image?: string | null; isActive: boolean; sortOrder: number; productCount: number;
}

const empty = { name: '', nameBn: '', slug: '', description: '', sortOrder: '0', isActive: true };

export default function CategoriesPage() {
  const can = useAdmin((s) => s.can);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [image, setImage] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<Category | null>(null);

  const load = () => {
    setLoading(true);
    adminApi.get('/categories?includeInactive=true')
      .then((res) => setCategories(res.data.categories ?? []))
      .catch((err) => toast.error(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openCreate = () => { setEditing(null); setForm({ ...empty }); setImage(''); setError(''); setOpen(true); };
  const openEdit = (c: Category) => {
    setEditing(c);
    setForm({ name: c.name, nameBn: c.nameBn ?? '', slug: c.slug, description: c.description ?? '', sortOrder: String(c.sortOrder), isActive: c.isActive });
    setImage(c.image ?? '');
    setError('');
    setOpen(true);
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      setImage(await uploadImage(files[0], 'categories'));
      toast.success('ছবি আপলোড হয়েছে');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'ছবি আপলোড করা যায়নি'));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setError('');
    if (form.name.trim().length < 2) { setError('ক্যাটাগরির নাম দিন।'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        nameBn: form.nameBn.trim() || null,
        slug: form.slug.trim() || undefined,
        description: form.description || null,
        image: image || null,
        imageUrl: image || undefined,
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
      };
      if (editing) { await adminApi.put(`/categories/${editing.id}`, payload); toast.success('ক্যাটাগরি আপডেট হয়েছে'); }
      else { await adminApi.post('/categories', payload); toast.success('ক্যাটাগরি যোগ হয়েছে'); }
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
      await adminApi.delete(`/categories/${deleting.id}`);
      toast.success('ক্যাটাগরি মুছে ফেলা হয়েছে');
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="ক্যাটাগরি"
        subtitle="পণ্যের শ্রেণিবিভাগ ও হোমপেজ গ্রিড"
        actions={can('categories:write') ? <Button icon={Plus} onClick={openCreate}>নতুন ক্যাটাগরি</Button> : undefined}
      />

      {loading ? <PageSpinner /> : categories.length === 0 ? (
        <EmptyState title="কোনো ক্যাটাগরি নেই" action={can('categories:write') ? <Button icon={Plus} onClick={openCreate}>নতুন ক্যাটাগরি</Button> : undefined} />
      ) : (
        <div className="card overflow-x-auto">
          <Table>
            <Thead>
              <tr><Th>ক্যাটাগরি</Th><Th>স্লাগ</Th><Th className="text-right">পণ্য</Th><Th>ক্রম</Th><Th>স্ট্যাটাস</Th><Th className="text-right">অ্যাকশন</Th></tr>
            </Thead>
            <Tbody>
              {categories.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <Td>
                    <div className="flex items-center gap-2">
                      <SmartImage src={mediaUrl(c.image)} alt={c.name} className="h-9 w-9 rounded-lg object-cover" />
                      <div>
                        <p className="font-medium text-ink-900">{c.name}</p>
                        {c.nameBn && <p className="text-[11px] text-gray-500">{c.nameBn}</p>}
                      </div>
                    </div>
                  </Td>
                  <Td className="font-mono text-xs text-gray-500">{c.slug}</Td>
                  <Td className="text-right tnum">{c.productCount}</Td>
                  <Td className="tnum">{c.sortOrder}</Td>
                  <Td><Badge tone={c.isActive ? 'green' : 'gray'}>{c.isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</Badge></Td>
                  <Td className="text-right">
                    {can('categories:write') && (
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
        title={editing ? 'ক্যাটাগরি সম্পাদনা' : 'নতুন ক্যাটাগরি'}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>বাতিল</Button><Button loading={saving} onClick={save}>সংরক্ষণ</Button></>}
      >
        {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="নাম (English)" requiredMark value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="নাম (বাংলা)" value={form.nameBn} onChange={(e) => setForm((f) => ({ ...f, nameBn: e.target.value }))} />
          <Input label="স্লাগ" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} hint={editing ? undefined : 'খালি রাখলে অটো তৈরি হবে'} />
          <Input label="ক্রম" type="number" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))} />
          <div className="sm:col-span-2">
            <Textarea label="বিবরণ" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <p className="label">ছবি</p>
            <div className="flex items-center gap-2">
              {image && <SmartImage src={mediaUrl(image)} alt="" className="h-16 w-16 rounded-lg border border-gray-200 object-cover" />}
              <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-brand-400 hover:text-brand-500">
                <ImagePlus className="h-4 w-4" />
                <span className="text-[10px]">{uploading ? '…' : 'আপলোড'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files)} disabled={uploading} />
              </label>
              {image && <button onClick={() => setImage('')} className="text-xs text-red-600 underline">ছবি সরান</button>}
            </div>
          </div>
          <div className="sm:col-span-2"><Switch checked={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} label="সক্রিয়" /></div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="ক্যাটাগরি মুছে ফেলবেন?"
        message={`"${deleting?.name}" মুছে ফেলা হবে। এর অধীনে থাকা পণ্যগুলো ক্যাটাগরিহীন হয়ে যাবে।`}
        onCancel={() => setDeleting(null)}
        onConfirm={remove}
        confirmLabel="মুছে ফেলুন"
      />
    </div>
  );
}
