import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, Trash2, ArrowRight, TicketPercent, Truck } from 'lucide-react';
import { api, getApiErrorMessage, mediaUrl } from '@/lib/api';
import { taka } from '@/lib/format';
import { useCart } from '@/store/cart';
import { useAuth } from '@/store/auth';
import { useSettings } from '@/store/settings';
import { toast } from '@/lib/toast';
import { Button, EmptyState, Input, LinkButton, SmartImage } from '@/components/ui';

interface Quote { charge: number; zoneName: string; freeShippingApplied: boolean; freeShippingThreshold: number | null; reason: string }

export default function CartPage() {
  const { items, setQuantity, remove } = useCart();
  const settings = useSettings((s) => s.settings);
  const token = useAuth((s) => s.token);
  const navigate = useNavigate();
  const [coupon, setCoupon] = useState('');
  const [couponState, setCouponState] = useState<{ code: string; discount: number; freeShipping: boolean } | null>(null);
  const [applying, setApplying] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const discount = couponState?.discount ?? 0;
  const shipping = couponState?.freeShipping ? 0 : quote?.charge ?? 0;

  useEffect(() => {
    // Quote uses the Dhaka zone by default; checkout re-quotes per address.
    api.get(`/shipping/quote?subtotal=${subtotal}&district=Dhaka`)
      .then((res) => setQuote(res.data.quote))
      .catch(() => setQuote(null));
  }, [subtotal]);

  useEffect(() => {
    const stored = sessionStorage.getItem('nb_coupon');
    if (stored) {
      try { setCouponState(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, []);

  const applyCoupon = async () => {
    if (!coupon.trim()) return;
    setApplying(true);
    try {
      const res = await api.post('/coupons/validate', { code: coupon.trim(), orderAmount: subtotal });
      const applied = { code: res.data.code, discount: res.data.discountAmount, freeShipping: res.data.freeShipping };
      setCouponState(applied);
      sessionStorage.setItem('nb_coupon', JSON.stringify(applied));
      toast.success(res.data.message);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setApplying(false);
    }
  };

  const removeCoupon = () => {
    setCouponState(null);
    sessionStorage.removeItem('nb_coupon');
    toast.info('কুপন সরানো হয়েছে');
  };

  if (items.length === 0) {
    return (
      <div className="container-page py-16">
        <EmptyState
          icon={ShoppingBag}
          title="আপনার কার্ট খালি"
          description="পছন্দের পণ্য যোগ করে কেনাকাটা শুরু করুন।"
          action={<LinkButton to="/shop" icon={ArrowRight}>কেনাকাটা শুরু করুন</LinkButton>}
        />
      </div>
    );
  }

  const total = Math.max(0, subtotal - discount + shipping);

  return (
    <div className="container-page py-6">
      <h1 className="mb-4 text-xl font-bold text-ink-900 sm:text-2xl">শপিং কার্ট ({items.length} টি পণ্য)</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.productId} className="card flex gap-3 p-3">
              <Link to={`/product/${item.slug}`} className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-gray-50">
                <SmartImage src={mediaUrl(item.image)} alt={item.name} className="h-full w-full object-cover" />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/product/${item.slug}`} className="line-clamp-2 text-sm font-medium text-ink-900 hover:text-brand-600">{item.name}</Link>
                  <button onClick={() => remove(item.productId)} className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="সরান">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {item.sku && <p className="text-xs text-gray-400">SKU: {item.sku}</p>}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                  <div className="flex items-center rounded-lg border border-gray-300">
                    <button onClick={() => setQuantity(item.productId, item.quantity - 1)} className="p-1.5 text-gray-600 hover:bg-gray-50" aria-label="কমান"><Minus className="h-3.5 w-3.5" /></button>
                    <span className="w-9 text-center text-sm tnum">{item.quantity}</span>
                    <button onClick={() => setQuantity(item.productId, item.quantity + 1)} disabled={item.quantity >= item.stock} className="p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40" aria-label="বাড়ান"><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-ink-900 tnum">{taka(item.price * item.quantity)}</p>
                    <p className="text-xs text-gray-500 tnum">{taka(item.price)} × {item.quantity}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between">
            <LinkButton to="/shop" variant="outline" size="sm">আরও পণ্য দেখুন</LinkButton>
            {quote && (
              <p className="flex items-center gap-1.5 text-xs text-gray-500">
                <Truck className="h-3.5 w-3.5" /> {quote.reason}
              </p>
            )}
          </div>
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="card p-4">
            <h2 className="mb-3 text-base font-semibold text-ink-900">অর্ডার সারসংক্ষেপ</h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">সাবটোটাল</span><span className="font-medium tnum">{taka(subtotal)}</span></div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>ডিসকাউন্ট ({couponState?.code})</span>
                  <span className="font-medium tnum">-{taka(discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">ডেলিভারি (ঢাকার ভিতরে)</span>
                <span className="font-medium tnum">{couponState?.freeShipping ? 'ফ্রি' : taka(shipping)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-gray-100 pt-2 text-base font-bold">
                <span>সর্বমোট</span>
                <span className="text-brand-600 tnum">{taka(total)}</span>
              </div>
              <p className="text-[11px] text-gray-400">চেকআউটে ঠিকানা অনুযায়ী ডেলিভারি চার্জ পুনরায় হিসাব হবে।</p>
            </div>

            <div className="mt-4">
              {couponState ? (
                <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  <span className="flex items-center gap-1.5"><TicketPercent className="h-3.5 w-3.5" /> {couponState.code} প্রয়োগ হয়েছে</span>
                  <button onClick={removeCoupon} className="underline">সরান</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input placeholder="কুপন কোড" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} aria-label="কুপন কোড" />
                  <Button variant="outline" onClick={applyCoupon} loading={applying}>প্রয়োগ</Button>
                </div>
              )}
            </div>

            <Button
              className="mt-4 w-full"
              size="lg"
              icon={ArrowRight}
              onClick={() => {
                if (!token) {
                  toast.info('চেকআউট করতে লগইন করুন');
                  navigate('/login?next=/checkout');
                  return;
                }
                navigate('/checkout');
              }}
            >
              চেকআউট করুন
            </Button>

            <p className="mt-2 text-center text-[11px] text-gray-400">
              {settings.free_shipping_enabled === 'true'
                ? `৳${settings.free_shipping_threshold}+ অর্ডারে ফ্রি ডেলিভারি (${settings.free_shipping_scope === 'all' ? 'সব এলাকায়' : 'ঢাকার ভিতরে'})`
                : 'ফ্রি ডেলিভারি বর্তমানে বন্ধ'}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
