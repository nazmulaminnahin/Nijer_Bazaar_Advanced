import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  User, Package, Heart, MapPin, Lock, Plus, Trash2, Pencil, Star, ShoppingBag,
} from 'lucide-react';
import { api, getApiErrorMessage, mediaUrl } from '@/lib/api';
import { taka, formatDate, orderStatusLabel, orderStatusTone } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { toast } from '@/lib/toast';
import { Badge, Button, EmptyState, Input, LinkButton, Modal, Select, SmartImage, Spinner, Tabs, Textarea } from '@/components/ui';
import { ProductCard, type ProductDTO } from '@/components/customer/ProductCard';
import { cn } from '@/lib/utils';

interface Address {
  id: number; label?: string | null; name: string; phone: string; address: string;
  division: string; district: string; thana: string; city?: string | null; postalCode?: string | null; isDefault: boolean;
}
interface OrderItem { id: number; productName: string; quantity: number; unitPrice: number; totalPrice: number; image?: string | null; productSlug?: string | null }
interface Order {
  id: number; orderNumber: string; status: string; paymentStatus: string; paymentMethod: string;
  total: number; subtotal: number; shippingCost: number; discount: number; createdAt: string; items: OrderItem[];
}

const TABS = [
  { value: 'info', label: 'আমার তথ্য' },
  { value: 'orders', label: 'অর্ডার' },
  { value: 'wishlist', label: 'উইশলিস্ট' },
  { value: 'addresses', label: 'ঠিকানা' },
];

export default function ProfilePage() {
  const { user, setUser, logout } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'info';

  const [profile, setProfile] = useState({ name: user?.name ?? '', email: user?.email ?? '', phone: user?.phone ?? '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [wishlist, setWishlist] = useState<ProductDTO[]>([]);
  const [wishLoading, setWishLoading] = useState(false);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [divisions, setDivisions] = useState<Array<{ name: string; nameBn: string; districts: Array<{ name: string; nameBn: string; thanas?: string[] }> }>>([]);
  const [addressModal, setAddressModal] = useState<{ open: boolean; editing: Address | null }>({ open: false, editing: null });
  const [addressForm, setAddressForm] = useState({ name: '', phone: '', address: '', division: 'Dhaka', district: 'Dhaka', thana: '', city: '', postalCode: '' });
  const [addressSaving, setAddressSaving] = useState(false);

  useEffect(() => {
    api.get('/geo').then((res) => setDivisions(res.data.divisions ?? [])).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (tab === 'orders' && orders.length === 0) {
      setOrdersLoading(true);
      api.get('/orders/my').then((res) => setOrders(res.data.orders ?? [])).catch(() => toast.error('অর্ডার লোড করা যায়নি')).finally(() => setOrdersLoading(false));
    }
    if (tab === 'wishlist' && wishlist.length === 0) {
      setWishLoading(true);
      api.get('/wishlist').then((res) => setWishlist(res.data.wishlist ?? [])).catch(() => toast.error('উইশলিস্ট লোড করা যায়নি')).finally(() => setWishLoading(false));
    }
    if (tab === 'addresses') {
      api.get('/addresses').then((res) => setAddresses(res.data.addresses ?? [])).catch(() => undefined);
    }
  }, [tab, orders.length, wishlist.length]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      const res = await api.put('/auth/profile', profile);
      setUser(res.data.user);
      toast.success('তথ্য সংরক্ষণ হয়েছে');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setProfileSaving(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.newPassword !== pw.confirm) { toast.error('নতুন পাসওয়ার্ড দুটি মিলছে না'); return; }
    setPwSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      toast.success('পাসওয়ার্ড পরিবর্তন হয়েছে');
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setPwSaving(false);
    }
  };

  const openAddress = (editing: Address | null) => {
    setAddressForm(
      editing
        ? { name: editing.name, phone: editing.phone, address: editing.address, division: editing.division, district: editing.district, thana: editing.thana, city: editing.city ?? '', postalCode: editing.postalCode ?? '' }
        : { name: user?.name ?? '', phone: user?.phone ?? '', address: '', division: 'Dhaka', district: 'Dhaka', thana: '', city: '', postalCode: '' }
    );
    setAddressModal({ open: true, editing });
  };

  const saveAddress = async () => {
    if (!addressForm.thana.trim()) { toast.error('থানা লিখুন'); return; }
    setAddressSaving(true);
    try {
      if (addressModal.editing) {
        await api.put(`/addresses/${addressModal.editing.id}`, addressForm);
        toast.success('ঠিকানা আপডেট হয়েছে');
      } else {
        await api.post('/addresses', addressForm);
        toast.success('ঠিকানা যোগ হয়েছে');
      }
      const res = await api.get('/addresses');
      setAddresses(res.data.addresses ?? []);
      setAddressModal({ open: false, editing: null });
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setAddressSaving(false);
    }
  };

  const deleteAddress = async (id: number) => {
    try {
      await api.delete(`/addresses/${id}`);
      setAddresses((list) => list.filter((a) => a.id !== id));
      toast.success('ঠিকানা মুছে ফেলা হয়েছে');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const makeDefault = async (id: number) => {
    try {
      await api.patch(`/addresses/${id}/default`);
      const res = await api.get('/addresses');
      setAddresses(res.data.addresses ?? []);
      toast.success('ডিফল্ট ঠিকানা সেট হয়েছে');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <div className="container-page py-6">
      <h1 className="mb-4 text-xl font-bold text-ink-900 sm:text-2xl">আমার অ্যাকাউন্ট</h1>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside>
          <div className="card p-4 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700">
              {user?.name?.charAt(0) ?? 'U'}
            </span>
            <p className="mt-2 font-semibold text-ink-900">{user?.name}</p>
            <p className="text-xs text-gray-500">{user?.phone || user?.email}</p>
            <button onClick={logout} className="mt-3 text-xs text-red-600 underline">লগআউট</button>
          </div>
          <nav className="card mt-3 overflow-hidden py-1">
            {TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setParams({ tab: t.value })}
                className={cn('flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm', tab === t.value ? 'border-l-2 border-brand-500 bg-brand-50 font-medium text-brand-700' : 'text-ink-700 hover:bg-gray-50')}
              >
                {t.value === 'info' ? <User className="h-4 w-4" /> : t.value === 'orders' ? <Package className="h-4 w-4" /> : t.value === 'wishlist' ? <Heart className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                {t.label}
              </button>
            ))}
          </nav>
        </aside>

        <div>
          {tab === 'info' && (
            <div className="space-y-4">
              <form onSubmit={saveProfile} className="card p-4">
                <h2 className="mb-3 text-sm font-semibold text-ink-900">ব্যক্তিগত তথ্য</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="পূর্ণ নাম" value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} />
                  <Input label="মোবাইল নম্বর" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} inputMode="tel" />
                  <div className="sm:col-span-2">
                    <Input label="ইমেইল" type="email" value={profile.email} onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} />
                  </div>
                </div>
                <Button type="submit" className="mt-3" loading={profileSaving}>সংরক্ষণ করুন</Button>
              </form>

              <form onSubmit={changePassword} className="card p-4">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900"><Lock className="h-4 w-4 text-brand-600" /> পাসওয়ার্ড পরিবর্তন</h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input label="বর্তমান পাসওয়ার্ড" type="password" value={pw.currentPassword} onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))} requiredMark />
                  <Input label="নতুন পাসওয়ার্ড" type="password" value={pw.newPassword} onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))} requiredMark />
                  <Input label="নতুন পাসওয়ার্ড আবার" type="password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} requiredMark />
                </div>
                <Button type="submit" className="mt-3" variant="outline" loading={pwSaving}>পরিবর্তন করুন</Button>
              </form>
            </div>
          )}

          {tab === 'orders' && (
            ordersLoading ? <Spinner className="py-16" /> :
            orders.length === 0 ? (
              <EmptyState icon={ShoppingBag} title="এখনো কোনো অর্ডার নেই" action={<LinkButton to="/shop">কেনাকাটা করুন</LinkButton>} />
            ) : (
              <div className="space-y-3">
                {orders.map((o) => (
                  <div key={o.id} className="card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2">
                      <div>
                        <p className="text-sm font-semibold text-ink-900">{o.orderNumber}</p>
                        <p className="text-xs text-gray-500">{formatDate(o.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={orderStatusTone(o.status)}>{orderStatusLabel(o.status)}</Badge>
                        <Badge tone={o.paymentStatus === 'paid' ? 'green' : 'gray'}>{o.paymentStatus === 'paid' ? 'পরিশোধিত' : 'অপরিশোধিত'}</Badge>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {o.items.map((it) => (
                        <div key={it.id} className="flex items-center gap-2">
                          <SmartImage src={mediaUrl(it.image)} alt={it.productName} className="h-10 w-10 rounded object-cover" />
                          <p className="min-w-0 flex-1 truncate text-sm text-ink-700">{it.productName}</p>
                          <p className="text-xs text-gray-500 tnum">{it.quantity} × {taka(it.unitPrice)}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2">
                      <Link to={`/track?order=${o.orderNumber}`} className="text-xs font-medium text-brand-600 hover:underline">ট্র্যাক করুন</Link>
                      <p className="text-sm font-bold text-brand-600 tnum">{taka(o.total)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'wishlist' && (
            wishLoading ? <Spinner className="py-16" /> :
            wishlist.length === 0 ? (
              <EmptyState icon={Heart} title="উইশলিস্ট খালি" description="পছন্দের পণ্যে ♥ আইকনে ক্লিক করে যোগ করুন।" action={<LinkButton to="/shop">পণ্য দেখুন</LinkButton>} />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
                {wishlist.map((p) => <ProductCard key={p.id} product={p} wished />)}
              </div>
            )
          )}

          {tab === 'addresses' && (
            <div>
              <div className="mb-3 flex justify-end">
                <Button size="sm" icon={Plus} onClick={() => openAddress(null)}>নতুন ঠিকানা</Button>
              </div>
              {addresses.length === 0 ? (
                <EmptyState icon={MapPin} title="কোনো ঠিকানা সংরক্ষিত নেই" description="ঠিকানা যোগ করলে চেকআউট দ্রুত হবে।" />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {addresses.map((a) => (
                    <div key={a.id} className="card p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-ink-900">{a.name}</p>
                          <p className="text-xs text-gray-500">{a.phone}</p>
                        </div>
                        {a.isDefault && <Badge tone="brand">ডিফল্ট</Badge>}
                      </div>
                      <p className="mt-2 text-sm text-gray-600">{a.address}, {a.thana}, {a.district}, {a.division}</p>
                      <div className="mt-3 flex items-center gap-3 text-xs">
                        <button onClick={() => openAddress(a)} className="flex items-center gap-1 text-brand-600 hover:underline"><Pencil className="h-3 w-3" /> সম্পাদনা</button>
                        {!a.isDefault && <button onClick={() => makeDefault(a.id)} className="flex items-center gap-1 text-gray-600 hover:underline"><Star className="h-3 w-3" /> ডিফল্ট করুন</button>}
                        <button onClick={() => deleteAddress(a.id)} className="flex items-center gap-1 text-red-600 hover:underline"><Trash2 className="h-3 w-3" /> মুছুন</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={addressModal.open}
        onClose={() => setAddressModal({ open: false, editing: null })}
        title={addressModal.editing ? 'ঠিকানা সম্পাদনা' : 'নতুন ঠিকানা'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddressModal({ open: false, editing: null })}>বাতিল</Button>
            <Button onClick={saveAddress} loading={addressSaving}>সংরক্ষণ</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="নাম" requiredMark value={addressForm.name} onChange={(e) => setAddressForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="মোবাইল" requiredMark value={addressForm.phone} onChange={(e) => setAddressForm((f) => ({ ...f, phone: e.target.value }))} inputMode="tel" />
          <div className="sm:col-span-2">
            <Textarea label="সম্পূর্ণ ঠিকানা" requiredMark value={addressForm.address} onChange={(e) => setAddressForm((f) => ({ ...f, address: e.target.value }))} />
          </div>
          <Select
            label="বিভাগ"
            value={addressForm.division}
            onChange={(e) => {
              const division = e.target.value;
              const first = divisions.find((d) => d.name === division)?.districts[0]?.name ?? '';
              setAddressForm((f) => ({ ...f, division, district: first, thana: '' }));
            }}
            options={divisions.map((d) => ({ value: d.name, label: `${d.nameBn} (${d.name})` }))}
          />
          <Select
            label="জেলা"
            value={addressForm.district}
            onChange={(e) => setAddressForm((f) => ({ ...f, district: e.target.value, thana: '' }))}
            options={(divisions.find((d) => d.name === addressForm.division)?.districts ?? []).map((d) => ({ value: d.name, label: `${d.nameBn} (${d.name})` }))}
          />
          <Input label="থানা" requiredMark value={addressForm.thana} onChange={(e) => setAddressForm((f) => ({ ...f, thana: e.target.value }))} />
          <Input label="শহর / এলাকা" value={addressForm.city} onChange={(e) => setAddressForm((f) => ({ ...f, city: e.target.value }))} />
        </div>
      </Modal>
    </div>
  );
}
