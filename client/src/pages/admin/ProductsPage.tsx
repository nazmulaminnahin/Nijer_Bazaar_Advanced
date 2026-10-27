import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2, ImagePlus, X, Eye, Star } from 'lucide-react';
import { adminApi, getApiErrorMessage, mediaUrl, uploadImage } from '@/lib/api';
import { taka, number } from '@/lib/format';
import { useAdmin } from '@/store/admin';
import { toast } from '@/lib/toast';
import {
  Badge, Button, ConfirmDialog, EmptyState, Input, Modal, Pagination, Select, SmartImage,
  Switch, Table, Tbody, Td, Th, Thead, Toolbar, PageSpinner, Textarea,
} from '@/components/admin/ui';
import { PageHeader } from '@/components/layout/AdminLayout';

interface Product {
  id: number; name: string; slug: string; sku: string; price: number; salePrice: number | null;
  effectivePrice: number; stock: number; lowStockThreshold: number; isActive: boolean;
  isFeatured: boolean; isNewArrival: boolean; mainImage: string | null; images: string[];
  categoryId: number | null; categoryName?: string | null; description?: string | null; shortDescription?: string | null;
}

const emptyForm = {
  name: '', sku: '', price: '', salePrice: '', costPrice: '', stock: '0', lowStockThreshold: '10',
  categoryId: '', shortDescription: '', description: '', isActive: true, isFeatured: false, isNewArrival: false,
};

export default function ProductsPage() {
  const can = useAdmin((s) => s.can);
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const page = Number(params.get('page') ?? 1);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(search);
  const [categoryFilter, setCategoryFilter] = useState(params.get('categoryId') ?? '');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), limit: '10' });
    if (search) q.set('search', search);
    if (categoryFilter) q.set('categoryId', categoryFilter);
    adminApi
      .get(`/products/admin/all?${q.toString()}`)
      .then((res) => {
        setProducts(res.data.products ?? []);
        setPagination({
          page: res.data.pagination?.page ?? 1,
          totalPages: res.data.pagination?.totalPages ?? 1,
          total: res.data.pagination?.total ?? 0,
        });
      })
      .catch((err) => toast.error(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [page, search, categoryFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    adminApi.get('/categories').then((res) => setCategories(res.data.categories ?? [])).catch(() => undefined);
  }, []);

  const setParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setImages([]);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku,
      price: String(p.price),
      salePrice: p.salePrice ? String(p.salePrice) : '',
      costPrice: '',
      stock: String(p.stock),
      lowStockThreshold: String(p.lowStockThreshold),
      categoryId: p.categoryId ? String(p.categoryId) : '',
      shortDescription: p.shortDescription ?? '',
      description: p.description ?? '',
      isActive: p.isActive,
      isFeatured: p.isFeatured,
      isNewArrival: p.isNewArrival,
    });
    setImages(p.images ?? []);
    setError('');
    setModalOpen(true);
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files).slice(0, 4)) {
        uploaded.push(await uploadImage(file, 'products'));
      }
      setImages((list) => [...list, ...uploaded]);
      toast.success('ছবি আপলোড হয়েছে');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'ছবি আপলোড করা যায়নি'));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setError('');
    if (form.name.trim().length < 2) { setError('পণ্যের নাম দিন।'); return; }
    if (!Number(form.price)) { setError('দাম ০ এর বেশি হতে হবে।'); return; }
    if (form.salePrice && Number(form.salePrice) >= Number(form.price)) { setError('সেল প্রাইস রেগুলার প্রাইসের চেয়ে কম হতে হবে।'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim() || undefined,
        price: Number(form.price),
        salePrice: form.salePrice ? Number(form.salePrice) : null,
        costPrice: form.costPrice ? Number(form.costPrice) : null,
        stock: Number(form.stock),
        lowStockThreshold: Number(form.lowStockThreshold),
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        shortDescription: form.shortDescription || null,
        description: form.description || null,
        images,
        imageUrl: images[0],
        isActive: form.isActive,
        isFeatured: form.isFeatured,
        isNewArrival: form.isNewArrival,
      };
      if (editing) {
        await adminApi.put(`/products/${editing.id}`, payload);
        toast.success('পণ্য আপডেট হয়েছে');
      } else {
        await adminApi.post('/products', payload);
        toast.success('পণ্য যোগ হয়েছে');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleField = async (p: Product, field: 'isActive' | 'isFeatured') => {
    try {
      await adminApi.patch(`/products/${p.id}`, { [field]: !p[field] });
      setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, [field]: !x[field] } : x)));
      toast.success('আপডেট হয়েছে');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await adminApi.delete(`/products/${deleting.id}`);
      toast.success('পণ্য মুছে ফেলা হয়েছে');
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="পণ্য ম্যানেজমেন্ট"
        subtitle={`মোট ${number(pagination.total)} টি পণ্য`}
        actions={can('products:write') ? <Button icon={Plus} onClick={openCreate}>নতুন পণ্য</Button> : undefined}
      />

      <Toolbar>
        <form onSubmit={(e) => { e.preventDefault(); setParam({ search: searchInput || null }); }} className="flex overflow-hidden rounded-lg border border-gray-300 bg-white">
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="নাম, SKU…" className="h-9 w-52 px-3 text-sm outline-none" aria-label="পণ্য খুঁজুন" />
          <button type="submit" className="bg-gray-100 px-3 text-gray-600 hover:bg-gray-200" aria-label="খুঁজুন"><Search className="h-4 w-4" /></button>
        </form>
        <Select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setParam({ categoryId: e.target.value || null }); }}
          options={[{ value: '', label: 'সব ক্যাটাগরি' }, ...categories.map((c) => ({ value: String(c.id), label: c.name }))]}
          className="h-9 w-44"
          aria-label="ক্যাটাগরি ফিল্টার"
        />
      </Toolbar>

      {loading ? <PageSpinner /> : products.length === 0 ? (
        <EmptyState title="কোনো পণ্য নেই" description="নতুন পণ্য যোগ করে শুরু করুন।" action={can('products:write') ? <Button icon={Plus} onClick={openCreate}>নতুন পণ্য</Button> : undefined} />
      ) : (
        <div className="card overflow-x-auto">
          <Table>
            <Thead>
              <tr>
                <Th>পণ্য</Th>
                <Th>ক্যাটাগরি</Th>
                <Th className="text-right">দাম</Th>
                <Th className="text-right">স্টক</Th>
                <Th>স্ট্যাটাস</Th>
                <Th className="text-right">অ্যাকশন</Th>
              </tr>
            </Thead>
            <Tbody>
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <Td>
                    <div className="flex items-center gap-2">
                      <SmartImage src={mediaUrl(p.mainImage)} alt={p.name} className="h-10 w-10 rounded-lg object-cover" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink-900">{p.name}</p>
                        <p className="text-[11px] text-gray-400">{p.sku}</p>
                      </div>
                    </div>
                  </Td>
                  <Td className="text-xs text-gray-600">{p.categoryName ?? '—'}</Td>
                  <Td className="text-right">
                    <p className="font-semibold tnum">{taka(p.effectivePrice)}</p>
                    {p.salePrice && <p className="text-[11px] text-gray-400 line-through tnum">{taka(p.price)}</p>}
                  </Td>
                  <Td className="text-right">
                    <span className={p.stock === 0 ? 'font-semibold text-red-600' : p.stock <= p.lowStockThreshold ? 'font-semibold text-amber-600' : 'tnum'}>{p.stock}</span>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      <Badge tone={p.isActive ? 'green' : 'gray'}>{p.isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</Badge>
                      {p.isFeatured && <Badge tone="brand">ফিচার্ড</Badge>}
                      {p.isNewArrival && <Badge tone="blue">নতুন</Badge>}
                    </div>
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      <a href={`/product/${p.slug}`} target="_blank" rel="noreferrer" className="rounded p-1.5 text-gray-500 hover:bg-gray-100" aria-label="সাইটে দেখুন"><Eye className="h-4 w-4" /></a>
                      {can('products:write') && (
                        <>
                          <button onClick={() => toggleField(p, 'isFeatured')} className={`rounded p-1.5 hover:bg-gray-100 ${p.isFeatured ? 'text-amber-500' : 'text-gray-400'}`} aria-label="ফিচার্ড টগল"><Star className="h-4 w-4" /></button>
                          <button onClick={() => openEdit(p)} className="rounded p-1.5 text-gray-500 hover:bg-brand-50 hover:text-brand-600" aria-label="সম্পাদনা"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => setDeleting(p)} className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600" aria-label="মুছুন"><Trash2 className="h-4 w-4" /></button>
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

      <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={10} onChange={(p) => setParam({ page: String(p) })} />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'পণ্য সম্পাদনা' : 'নতুন পণ্য'}
        size="xl"
        footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>বাতিল</Button><Button loading={saving} onClick={save}>সংরক্ষণ</Button></>}
      >
        {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input label="পণ্যের নাম" requiredMark value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <Input label="SKU" value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} hint={editing ? undefined : 'খালি রাখলে অটো তৈরি হবে'} />
          <Select label="ক্যাটাগরি" value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))} options={[{ value: '', label: 'ক্যাটাগরি নেই' }, ...categories.map((c) => ({ value: String(c.id), label: c.name }))]} />
          <Input label="রেগুলার দাম (৳)" requiredMark type="number" min={0} value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
          <Input label="সেল প্রাইস (৳)" type="number" min={0} value={form.salePrice} onChange={(e) => setForm((f) => ({ ...f, salePrice: e.target.value }))} hint="খালি রাখলে সেল প্রাইস থাকবে না" />
          <Input label="ক্রয় মূল্য (৳)" type="number" min={0} value={form.costPrice} onChange={(e) => setForm((f) => ({ ...f, costPrice: e.target.value }))} hint="শুধু অ্যাডমিন দেখে" />
          <Input label="স্টক" type="number" min={0} value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} />
          <Input label="লো স্টক থ্রেশহোল্ড" type="number" min={0} value={form.lowStockThreshold} onChange={(e) => setForm((f) => ({ ...f, lowStockThreshold: e.target.value }))} />
          <div className="sm:col-span-2">
            <Textarea label="সংক্ষিপ্ত বিবরণ" value={form.shortDescription} onChange={(e) => setForm((f) => ({ ...f, shortDescription: e.target.value }))} rows={2} />
          </div>
          <div className="sm:col-span-2">
            <Textarea label="পূর্ণ বিবরণ" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={4} />
          </div>

          <div className="sm:col-span-2">
            <p className="label">ছবি</p>
            <div className="flex flex-wrap gap-2">
              {images.map((img, idx) => (
                <div key={`${img}-${idx}`} className="relative h-20 w-20 overflow-hidden rounded-lg border border-gray-200">
                  <SmartImage src={mediaUrl(img)} alt="" className="h-full w-full object-cover" />
                  <button onClick={() => setImages((list) => list.filter((_, i) => i !== idx))} className="absolute right-0.5 top-0.5 rounded-full bg-white/90 p-0.5 text-red-600" aria-label="ছবি সরান"><X className="h-3 w-3" /></button>
                  {idx === 0 && <span className="absolute bottom-0 left-0 right-0 bg-brand-500/90 text-center text-[9px] text-white">প্রধান</span>}
                </div>
              ))}
              <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-brand-400 hover:text-brand-500">
                <ImagePlus className="h-5 w-5" />
                <span className="text-[10px]">{uploading ? 'আপলোড…' : 'যোগ করুন'}</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} disabled={uploading} />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 sm:col-span-2">
            <Switch checked={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} label="সক্রিয়" />
            <Switch checked={form.isFeatured} onChange={(v) => setForm((f) => ({ ...f, isFeatured: v }))} label="ফিচার্ড" />
            <Switch checked={form.isNewArrival} onChange={(v) => setForm((f) => ({ ...f, isNewArrival: v }))} label="নতুন এসেছে" />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="পণ্য মুছে ফেলবেন?"
        message={`"${deleting?.name}" মুছে ফেলা হবে। অর্ডার হিস্ট্রি অপরিবর্তিত থাকবে।`}
        confirmLabel="মুছে ফেলুন"
        onCancel={() => setDeleting(null)}
        onConfirm={remove}
      />
    </div>
  );
}
