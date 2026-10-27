import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PackageSearch, Search, CheckCircle2, Circle } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { taka, formatDate, orderStatusLabel } from '@/lib/format';
import { Badge, Button, EmptyState, Input } from '@/components/ui';
import { cn } from '@/lib/utils';

const FLOW = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

export default function TrackOrderPage() {
  const [params] = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(params.get('order') ?? '');
  const [phone, setPhone] = useState('');
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const search = async (num = orderNumber, ph = phone) => {
    if (!num.trim()) { setError('অর্ডার নম্বর দিন'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/orders/track?orderNumber=${encodeURIComponent(num.trim())}${ph ? `&phone=${encodeURIComponent(ph)}` : ''}`);
      setOrder(res.data.order);
    } catch (err) {
      setOrder(null);
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.get('order')) void search(params.get('order')!, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeIndex = order ? FLOW.indexOf(order.status) : -1;

  return (
    <div className="container-page max-w-2xl py-10">
      <div className="text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600"><PackageSearch className="h-6 w-6" /></span>
        <h1 className="mt-3 text-xl font-bold text-ink-900 sm:text-2xl">অর্ডার ট্র্যাকিং</h1>
        <p className="mt-1 text-sm text-gray-500">অর্ডার নম্বর ও মোবাইল নম্বর দিয়ে অবস্থা জানুন</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void search(); }} className="card mt-6 grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto]">
        <Input label="অর্ডার নম্বর" placeholder="NB-XXXXXX-XXXX" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
        <Input label="মোবাইল নম্বর" placeholder="01712345678" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
        <div className="flex items-end"><Button type="submit" icon={Search} loading={loading} className="w-full sm:w-auto">খুঁজুন</Button></div>
      </form>

      {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {order && (
        <div className="card mt-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-ink-900">{order.orderNumber}</p>
              <p className="text-xs text-gray-500">{formatDate(order.createdAt)}</p>
            </div>
            <Badge tone="brand">{orderStatusLabel(order.status)}</Badge>
          </div>

          <div className="mt-5 space-y-3">
            {FLOW.map((step, i) => {
              const done = activeIndex >= i;
              return (
                <div key={step} className="flex items-start gap-3">
                  {done ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-gray-300" />}
                  <div className={cn('flex-1 border-b border-gray-100 pb-2', i === FLOW.length - 1 && 'border-none')}>
                    <p className={cn('text-sm', done ? 'font-medium text-ink-900' : 'text-gray-400')}>{orderStatusLabel(step)}</p>
                  </div>
                </div>
              );
            })}
            {order.status === 'cancelled' && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">এই অর্ডারটি বাতিল করা হয়েছে।</p>
            )}
          </div>

          <div className="mt-4 border-t border-gray-100 pt-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">পণ্য</span><span>{order.items?.length ?? 0} টি</span></div>
            <div className="flex justify-between"><span className="text-gray-500">ডেলিভারি ঠিকানা</span><span className="text-right text-xs">{order.shippingAddress?.thana}, {order.shippingAddress?.district}</span></div>
            <div className="mt-1 flex justify-between font-bold"><span>সর্বমোট</span><span className="text-brand-600 tnum">{taka(order.total)}</span></div>
          </div>
        </div>
      )}

      {!order && !error && (
        <div className="mt-6">
          <EmptyState title="অর্ডার নম্বর দিয়ে খুঁজুন" description="অর্ডার কনফার্মেশনে পাঠানো নম্বরটি ব্যবহার করুন।" />
        </div>
      )}
    </div>
  );
}
