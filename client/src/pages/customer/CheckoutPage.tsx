import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, MapPin, Plus, TicketPercent, Truck, User } from 'lucide-react';
import { api, getApiErrorMessage, mediaUrl } from '@/lib/api';
import { taka } from '@/lib/format';
import { useCart } from '@/store/cart';
import { useAuth } from '@/store/auth';
import { toast } from '@/lib/toast';
import { Button, EmptyState, Input, LinkButton, Select, SmartImage, Textarea } from '@/components/ui';
import { cn } from '@/lib/utils';

interface Division { name: string; nameBn: string; districts: Array<{ name: string; nameBn: string; thanas?: string[] }> }
interface Address {
  id: number; label?: string | null; name: string; phone: string; address: string;
  division: string; district: string; thana: string; city?: string | null; postalCode?: string | null; isDefault: boolean;
}
interface Quote { charge: number; zoneName: string; freeShippingApplied: boolean; reason: string }

const emptyForm = {
  name: '', phone: '', email: '', address: '', division: 'Dhaka', district: 'Dhaka',
  thana: '', city: '', postalCode: '', note: '',
};

export default function CheckoutPage() {
  const { items, clear } = useCart();
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();

  const [divisions, setDivisions] = useState<Division[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<number | 'new'>('new');
  const [form, setForm] = useState({ ...emptyForm, name: user?.name ?? '', phone: user?.phone ?? '', email: user?.email ?? '' });
  const [saveAddress, setSaveAddress] = useState(false);
  const [payment, setPayment] = useState('cod');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [coupon, setCoupon] = useState<{ code: string; discount: number; freeShipping: boolean } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState<any>(null);

  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.price * i.quantity, 0), [items]);
  const discount = coupon?.discount ?? 0;
  const shipping = coupon?.freeShipping ? 0 : quote?.charge ?? 0;
  const total = Math.max(0, subtotal - discount + shipping);

  useEffect(() => {
    api.get('/geo').then((res) => setDivisions(res.data.divisions ?? [])).catch(() => undefined);
    api.get('/addresses').then((res) => {
      const list: Address[] = res.data.addresses ?? [];
      setAddresses(list);
      const def = list.find((a) => a.isDefault) ?? list[0];
      if (def) {
        setSelectedAddress(def.id);
        setForm((f) => ({
          ...f, name: def.name, phone: def.phone, address: def.address,
          division: def.division, district: def.district, thana: def.thana,
          city: def.city ?? '', postalCode: def.postalCode ?? '',
        }));
      }
    }).catch(() => undefined);
    const stored = sessionStorage.getItem('nb_coupon');
    if (stored) { try { setCoupon(JSON.parse(stored)); } catch { /* ignore */ } }
  }, []);

  // Server-side quote keeps the advertised policy and the charge in sync.
  useEffect(() => {
    if (!form.district) return;
    const district = form.district;
    api.get(`/shipping/quote?subtotal=${subtotal}&district=${encodeURIComponent(district)}`)
      .then((res) => setQuote(res.data.quote))
      .catch(() => setQuote(null));
  }, [subtotal, form.district]);

  const currentDivision = divisions.find((d) => d.name === form.division);
  const districtOptions = (currentDivision?.districts ?? []).map((d) => ({ value: d.name, label: `${d.nameBn} (${d.name})` }));
  const thanaSuggestions = currentDivision?.districts.find((d) => d.name === form.district)?.thanas ?? [];

  const set = (key: keyof typeof form) => (value: string) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === 'division') {
        const first = divisions.find((d) => d.name === value)?.districts[0]?.name ?? '';
        next.district = first;
        next.thana = '';
      }
      if (key === 'district') next.thana = '';
      return next;
    });
    setErrors((e) => ({ ...e, [key]: '' }));
    if (key === 'division' || key === 'district' || key === 'address') setSelectedAddress('new');
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = 'নাম লিখুন।';
    if (!/^01[3-9]\d{8}$/.test(form.phone.replace(/\D/g, ''))) e.phone = 'সঠিক মোবাইল নম্বর দিন (যেমন 01712345678)।';
    if (form.address.trim().length < 6) e.address = 'সম্পূর্ণ ঠিকানা লিখুন।';
    if (!form.division) e.division = 'বিভাগ নির্বাচন করুন।';
    if (!form.district) e.district = 'জেলা নির্বাচন করুন।';
    if (!form.thana.trim() || form.thana.trim().length < 2) e.thana = 'থানা লিখুন।';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const placeOrder = async () => {
    if (!validate()) {
      toast.error('অনুগ্রহ করে সব প্রয়োজনীয় তথ্য সঠিকভাবে পূরণ করুন।');
      return;
    }
    setSubmitting(true);
    try {
      if (saveAddress) {
        await api.post('/addresses', {
          name: form.name, phone: form.phone, address: form.address, division: form.division,
          district: form.district, thana: form.thana, city: form.city || undefined,
          postalCode: form.postalCode || undefined,
        }).catch(() => undefined);
      }
      const res = await api.post('/orders', {
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        shippingAddress: {
          name: form.name, phone: form.phone, address: form.address, division: form.division,
          district: form.district, thana: form.thana, city: form.city || undefined,
          postalCode: form.postalCode || undefined, email: form.email || undefined, note: form.note || undefined,
        },
        paymentMethod: payment,
        couponCode: coupon?.code,
        notes: form.note || undefined,
      });
      clear();
      sessionStorage.removeItem('nb_coupon');
      setPlaced(res.data.order);
      toast.success(res.data.message);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (placed) {
    return (
      <div className="container-page py-12">
        <div className="mx-auto max-w-lg text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-ink-900">অর্ডার সফল হয়েছে!</h1>
          <p className="mt-1 text-sm text-gray-500">আমরা শীঘ্রই আপনার সাথে যোগাযোগ করব।</p>
          <div className="card mt-6 p-5 text-left">
            <div className="flex justify-between text-sm"><span className="text-gray-500">অর্ডার নম্বর</span><span className="font-semibold">{placed.orderNumber}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">ইনভয়েস</span><span className="font-semibold">{placed.invoiceNumber}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">সর্বমোট</span><span className="font-bold text-brand-600 tnum">{taka(placed.total)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">ডেলিভারি চার্জ</span><span className="tnum">{taka(placed.shippingCost)}</span></div>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <LinkButton to="/profile?tab=orders">আমার অর্ডার</LinkButton>
            <LinkButton to="/shop" variant="outline">আরও কেনাকাটা</LinkButton>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container-page py-16">
        <EmptyState title="চেকআউট করার জন্য কার্টে পণ্য নেই" action={<LinkButton to="/shop">পণ্য দেখুন</LinkButton>} />
      </div>
    );
  }

  return (
    <div className="container-page py-6">
      <h1 className="mb-4 text-xl font-bold text-ink-900 sm:text-2xl">চেকআউট</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {/* Saved addresses */}
          {addresses.length > 0 && (
            <div className="card p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900"><MapPin className="h-4 w-4 text-brand-600" /> সংরক্ষিত ঠিকানা</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {addresses.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setSelectedAddress(a.id);
                      setForm((f) => ({ ...f, name: a.name, phone: a.phone, address: a.address, division: a.division, district: a.district, thana: a.thana, city: a.city ?? '', postalCode: a.postalCode ?? '' }));
                      setErrors({});
                    }}
                    className={cn('rounded-lg border p-3 text-left text-sm transition', selectedAddress === a.id ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-200' : 'border-gray-200 hover:border-gray-300')}
                  >
                    <p className="font-medium text-ink-900">{a.name} <span className="text-xs font-normal text-gray-500">{a.phone}</span></p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-gray-600">{a.address}, {a.thana}, {a.district}</p>
                    {a.isDefault && <span className="mt-1 inline-block rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">ডিফল্ট</span>}
                  </button>
                ))}
                <button
                  onClick={() => { setSelectedAddress('new'); setForm({ ...emptyForm, name: user?.name ?? '', phone: user?.phone ?? '' }); }}
                  className={cn('flex items-center justify-center gap-1.5 rounded-lg border border-dashed p-3 text-sm', selectedAddress === 'new' ? 'border-brand-500 text-brand-700' : 'border-gray-300 text-gray-500 hover:border-gray-400')}
                >
                  <Plus className="h-4 w-4" /> নতুন ঠিকানা
                </button>
              </div>
            </div>
          )}

          {/* Bangladesh address form */}
          <div className="card p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900"><User className="h-4 w-4 text-brand-600" /> ডেলিভারি তথ্য</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="নাম" requiredMark value={form.name} onChange={(e) => set('name')(e.target.value)} error={errors.name} placeholder="আপনার পূর্ণ নাম" />
              <Input label="মোবাইল নম্বর" requiredMark value={form.phone} onChange={(e) => set('phone')(e.target.value)} error={errors.phone} placeholder="01XXXXXXXXX" inputMode="tel" />
              <div className="sm:col-span-2">
                <Input label="সম্পূর্ণ ঠিকানা" requiredMark value={form.address} onChange={(e) => set('address')(e.target.value)} error={errors.address} placeholder="বাসা/রোড/এলাকা" />
              </div>
              <Select label="বিভাগ" requiredMark value={form.division} onChange={(e) => set('division')(e.target.value)} options={divisions.map((d) => ({ value: d.name, label: `${d.nameBn} (${d.name})` }))} error={errors.division} placeholder="বিভাগ নির্বাচন করুন" />
              <Select label="জেলা" requiredMark value={form.district} onChange={(e) => set('district')(e.target.value)} options={districtOptions} error={errors.district} placeholder="জেলা নির্বাচন করুন" />
              <div>
                <Input label="থানা" requiredMark value={form.thana} onChange={(e) => set('thana')(e.target.value)} error={errors.thana} placeholder="থানা / পুলিশ স্টেশন" list="thana-options" />
                {thanaSuggestions.length > 0 && (
                  <datalist id="thana-options">
                    {thanaSuggestions.map((t) => <option key={t} value={t} />)}
                  </datalist>
                )}
                {thanaSuggestions.length > 0 && <p className="mt-1 text-[11px] text-gray-400">সাজেশন থেকে বেছে নিতে পারেন, অথবা নিজে লিখুন</p>}
              </div>
              <Input label="শহর / এলাকা" value={form.city} onChange={(e) => set('city')(e.target.value)} placeholder="ঐচ্ছিক" />
              <Input label="পোস্ট কোড" value={form.postalCode} onChange={(e) => set('postalCode')(e.target.value)} placeholder="যেখানে প্রযোজ্য" inputMode="numeric" />
              <Input label="ইমেইল (ঐচ্ছিক)" value={form.email} onChange={(e) => set('email')(e.target.value)} placeholder="you@example.com" type="email" />
              <div className="sm:col-span-2">
                <Textarea label="অর্ডার নোট (ঐচ্ছিক)" value={form.note} onChange={(e) => set('note')(e.target.value)} placeholder="ডেলিভারি সম্পর্কিত নির্দেশনা থাকলে লিখুন" />
              </div>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-brand-500" />
              এই ঠিকানাটি পরবর্তী অর্ডারের জন্য সংরক্ষণ করুন
            </label>
          </div>

          {/* Payment */}
          <div className="card p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink-900">পেমেন্ট পদ্ধতি</h2>
            <div className="space-y-2">
              {[
                { value: 'cod', label: 'ক্যাশ অন ডেলিভারি', hint: 'পণ্য হাতে পেয়ে টাকা দিন' },
                { value: 'bkash', label: 'বিকাশ', hint: 'অর্ডার নিশ্চিত করার পর বিকাশ নম্বর দেওয়া হবে' },
                { value: 'nagad', label: 'নগদ', hint: 'অর্ডার নিশ্চিত করার পর নগদ নম্বর দেওয়া হবে' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPayment(opt.value)}
                  className={cn('flex w-full items-start gap-3 rounded-lg border p-3 text-left', payment === opt.value ? 'border-brand-500 bg-brand-50/40' : 'border-gray-200')}
                >
                  <span className={cn('mt-1 h-4 w-4 shrink-0 rounded-full border-2', payment === opt.value ? 'border-brand-500 bg-brand-500 ring-2 ring-brand-200' : 'border-gray-300')} />
                  <span>
                    <span className="block text-sm font-medium text-ink-900">{opt.label}</span>
                    <span className="block text-xs text-gray-500">{opt.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="card p-4">
            <h2 className="mb-3 text-base font-semibold text-ink-900">অর্ডার সারসংক্ষেপ</h2>
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {items.map((i) => (
                <div key={i.productId} className="flex gap-2">
                  <SmartImage src={mediaUrl(i.image)} alt={i.name} className="h-12 w-12 shrink-0 rounded object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-xs font-medium text-ink-900">{i.name}</p>
                    <p className="text-xs text-gray-500">{i.quantity} × {taka(i.price)}</p>
                  </div>
                  <p className="text-xs font-semibold tnum">{taka(i.price * i.quantity)}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 space-y-2 border-t border-gray-100 pt-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">সাবটোটাল</span><span className="tnum">{taka(subtotal)}</span></div>
              {discount > 0 && <div className="flex justify-between text-emerald-600"><span className="flex items-center gap-1"><TicketPercent className="h-3.5 w-3.5" /> {coupon?.code}</span><span className="tnum">-{taka(discount)}</span></div>}
              <div className="flex justify-between">
                <span className="flex items-center gap-1 text-gray-500"><Truck className="h-3.5 w-3.5" /> ডেলিভারি {quote ? `(${quote.zoneName})` : ''}</span>
                <span className="tnum">{coupon?.freeShipping ? 'ফ্রি' : taka(shipping)}</span>
              </div>
              {quote && <p className={cn('text-[11px]', quote.freeShippingApplied ? 'text-emerald-600' : 'text-gray-400')}>{quote.reason}</p>}
              <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-bold">
                <span>সর্বমোট</span>
                <span className="text-brand-600 tnum">{taka(total)}</span>
              </div>
            </div>

            <Button className="mt-4 w-full" size="lg" loading={submitting} onClick={placeOrder}>
              অর্ডার নিশ্চিত করুন
            </Button>
            <p className="mt-2 text-center text-[11px] text-gray-400">
              অর্ডার করার মাধ্যমে আপনি আমাদের শর্তাবলী মেনে নিচ্ছেন। <Link to="/about" className="underline">আরও জানুন</Link>
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
