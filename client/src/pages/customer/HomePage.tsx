import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BadgeCheck, Clock, HeadphonesIcon, RefreshCw, ShieldCheck, Sparkles,
  Star, Truck, Zap, ChevronRight, Wallet,
} from 'lucide-react';
import { api, mediaUrl } from '@/lib/api';
import { taka } from '@/lib/format';
import { useSettings } from '@/store/settings';
import { ProductCard, ProductCardSkeleton, type ProductDTO } from '@/components/customer/ProductCard';
import { Button, EmptyState, LinkButton, SmartImage, Tabs } from '@/components/ui';

interface Category { id: number; name: string; nameBn?: string | null; slug: string; image?: string | null; productCount?: number }
interface FlashSale { id: number; title: string; description?: string; endAt: string; type: string; value: number }
interface Testimonial { id: number; name: string; location?: string; rating: number; message: string; avatar?: string }

export default function HomePage() {
  const settings = useSettings((s) => s.settings);
  const [categories, setCategories] = useState<Category[]>([]);
  const [featured, setFeatured] = useState<ProductDTO[]>([]);
  const [newArrivals, setNewArrivals] = useState<ProductDTO[]>([]);
  const [flash, setFlash] = useState<FlashSale | null>(null);
  const [flashProducts, setFlashProducts] = useState<ProductDTO[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [tab, setTab] = useState<'featured' | 'new' | 'popular'>('featured');
  const [popular, setPopular] = useState<ProductDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [cats, feat, fresh, flashRes, flashItems, reviews, pop] = await Promise.all([
        api.get('/categories').catch(() => null),
        api.get('/products?featured=true&limit=8').catch(() => null),
        api.get('/products?newArrival=true&limit=8').catch(() => null),
        api.get('/flash-sales/active').catch(() => null),
        api.get('/products?flashSale=true&limit=4').catch(() => null),
        api.get('/testimonials').catch(() => null),
        api.get('/products?sort=popular&limit=8').catch(() => null),
      ]);
      if (!alive) return;
      setCategories(cats?.data.categories ?? []);
      setFeatured(feat?.data.products ?? []);
      setNewArrivals(fresh?.data.products ?? []);
      setFlash(flashRes?.data.current ?? null);
      setFlashProducts(flashItems?.data.products ?? []);
      setTestimonials(reviews?.data.testimonials ?? []);
      setPopular(pop?.data.products ?? []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const products = tab === 'featured' ? featured : tab === 'new' ? newArrivals : popular;

  const heading = useMemo(() => {
    const freeShip = settings.free_shipping_enabled === 'true'
      ? `৳${settings.free_shipping_threshold}+ অর্ডারে ফ্রি ডেলিভারি${settings.free_shipping_scope === 'all' ? '' : ' (ঢাকা)'}`
      : 'সারা দেশে দ্রুত ডেলিভারি';
    return [freeShip, '১০০% অরিজিনাল পণ্য', 'ক্যাশ অন ডেলিভারি'];
  }, [settings]);

  return (
    <div className="pb-8">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-500 to-amber-500 text-white">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
        <div className="absolute -bottom-24 left-10 h-72 w-72 rounded-full bg-white/5" />
        <div className="container-page relative grid items-center gap-8 py-10 sm:py-14 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" /> {settings.site_tagline}
            </span>
            <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl lg:text-5xl">
              নিজের বাজার — <br className="hidden sm:block" />
              প্রতিদিনের প্রয়োজন, <span className="text-amber-200">এক জায়গায়</span>
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/90 sm:text-base">
              যাচাইকৃত পণ্য, সঠিক দাম আর দ্রুত ডেলিভারি — ঢাকার ভিতরে সর্বনিম্ন {taka(settings.inside_dhaka_charge)}, সারা দেশে {taka(settings.outside_dhaka_charge)}।
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <LinkButton to="/shop" size="lg" variant="secondary" icon={ArrowRight} className="bg-white text-brand-700 hover:bg-amber-50">
                এখনই কিনুন
              </LinkButton>
              {flash && (
                <LinkButton to="/shop?flashSale=true" size="lg" variant="outline" icon={Zap} className="border-white/50 bg-white/10 text-white hover:bg-white/20">
                  ফ্ল্যাশ সেল
                </LinkButton>
              )}
            </div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/90">
              {heading.map((h) => (
                <span key={h} className="flex items-center gap-1.5"><BadgeCheck className="h-4 w-4 text-amber-200" /> {h}</span>
              ))}
            </div>
          </div>

          <div className="relative hidden lg:block">
            <div className="grid grid-cols-2 gap-3">
              {(featured.slice(0, 4).length ? featured.slice(0, 4) : newArrivals.slice(0, 4)).map((p) => (
                <Link
                  key={p.id}
                  to={`/product/${p.slug}`}
                  className="overflow-hidden rounded-xl bg-white/95 p-2 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
                >
                  <SmartImage src={mediaUrl(p.mainImage)} alt={p.name} className="h-28 w-full rounded-lg object-cover" />
                  <p className="mt-2 line-clamp-1 text-xs font-medium text-ink-900">{p.name}</p>
                  <p className="text-sm font-bold text-brand-600 tnum">{taka(p.effectivePrice)}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-gray-200 bg-white">
        <div className="container-page grid grid-cols-2 gap-4 py-4 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { icon: Truck, title: 'দ্রুত ডেলিভারি', text: 'ঢাকায় ২৪–৪৮ ঘণ্টা' },
            { icon: ShieldCheck, title: '১০০% অরিজিনাল', text: 'যাচাইকৃত পণ্য' },
            { icon: RefreshCw, title: 'সহজ রিটার্ন', text: 'সমস্যা হলে বদল' },
            { icon: Wallet, title: 'ক্যাশ অন ডেলিভারি', text: 'হাতে পেয়ে টাকা' },
            { icon: HeadphonesIcon, title: 'গ্রাহক সেবা', text: settings.support_hours },
          ].map((f) => (
            <div key={f.title} className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600"><f.icon className="h-4 w-4" /></span>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-ink-900">{f.title}</p>
                <p className="truncate text-[11px] text-gray-500">{f.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="container-page py-8">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-lg font-bold text-ink-900 sm:text-xl">ক্যাটাগরি</h2>
              <p className="text-sm text-gray-500">যা খুঁজছেন, সহজে খুঁজে নিন</p>
            </div>
            <Link to="/shop" className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700">
              সব দেখুন <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {categories.slice(0, 12).map((c) => (
              <Link key={c.id} to={`/shop?category=${c.slug}`} className="group rounded-xl border border-gray-200 bg-white p-3 text-center transition hover:border-brand-300 hover:shadow-card">
                <div className="mx-auto h-16 w-16 overflow-hidden rounded-full bg-brand-50 p-1">
                  <SmartImage src={mediaUrl(c.image)} alt={c.name} className="h-full w-full rounded-full object-cover" />
                </div>
                <p className="mt-2 line-clamp-2 text-xs font-medium text-ink-900 group-hover:text-brand-600">{c.nameBn || c.name}</p>
                {c.productCount != null && <p className="text-[10px] text-gray-400">{c.productCount} টি পণ্য</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Flash sale */}
      {flash && flashProducts.length > 0 && (
        <section className="bg-gradient-to-r from-red-50 to-amber-50 py-8">
          <div className="container-page">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white"><Zap className="h-5 w-5" /></span>
                <div>
                  <h2 className="text-lg font-bold text-ink-900 sm:text-xl">{flash.title}</h2>
                  <p className="text-sm text-gray-600">সীমিত সময়ের অফার — শেষ হওয়ার আগেই নিন</p>
                </div>
              </div>
              <Countdown endAt={flash.endAt} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {flashProducts.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        </section>
      )}

      {/* Products tabs */}
      <section className="container-page py-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-ink-900 sm:text-xl">আমাদের পণ্য</h2>
            <p className="text-sm text-gray-500">সবচেয়ে জনপ্রিয় ও নতুন পণ্যসমূহ</p>
          </div>
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'featured', label: 'ফিচার্ড' },
              { value: 'new', label: 'নতুন এসেছে' },
              { value: 'popular', label: 'বেস্ট সেলার' },
            ]}
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
          </div>
        ) : products.length === 0 ? (
          <EmptyState title="এখনো কোনো পণ্য যোগ করা হয়নি" description="অ্যাডমিন প্যানেল থেকে পণ্য যোগ করুন।" action={<LinkButton to="/shop" variant="outline">সব পণ্য দেখুন</LinkButton>} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}

        <div className="mt-6 text-center">
          <LinkButton to="/shop" variant="outline" icon={ArrowRight}>সব পণ্য দেখুন</LinkButton>
        </div>
      </section>

      {/* Testimonials — only published, real reviews */}
      {testimonials.length > 0 && (
        <section className="bg-white py-10">
          <div className="container-page">
            <div className="mb-5 text-center">
              <h2 className="text-lg font-bold text-ink-900 sm:text-xl">গ্রাহকরা যা বলছেন</h2>
              <p className="text-sm text-gray-500">আমাদের গ্রাহকদের অভিজ্ঞতা</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {testimonials.slice(0, 6).map((t) => (
                <div key={t.id} className="card p-5">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={i < t.rating ? 'h-4 w-4 fill-amber-400 text-amber-400' : 'h-4 w-4 text-gray-200'} />
                    ))}
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-gray-700">“{t.message}”</p>
                  <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{t.name.charAt(0)}</span>
                    <div>
                      <p className="text-sm font-medium text-ink-900">{t.name}</p>
                      {t.location && <p className="text-xs text-gray-500">{t.location}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="container-page py-10">
        <div className="rounded-2xl bg-ink-900 px-6 py-8 text-center text-white sm:px-10">
          <h2 className="text-xl font-bold sm:text-2xl">নতুন অফার সবার আগে পান</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-gray-300">
            রেজিস্ট্রেশন করে উইশলিস্ট, অর্ডার ট্র্যাকিং ও এক্সক্লুসিভ ডিসকাউন্টের সুবিধা নিন।
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <LinkButton to="/register" size="lg" className="bg-brand-500 hover:bg-brand-600">ফ্রি রেজিস্ট্রেশন</LinkButton>
            <Link to="/contact" className="inline-flex h-12 items-center rounded-lg border border-white/30 px-6 text-sm font-medium hover:bg-white/10">যোগাযোগ করুন</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function Countdown({ endAt }: { endAt: string }) {
  const [remaining, setRemaining] = useState(() => new Date(endAt).getTime() - Date.now());
  useEffect(() => {
    const timer = setInterval(() => setRemaining(new Date(endAt).getTime() - Date.now()), 1000);
    return () => clearInterval(timer);
  }, [endAt]);

  if (remaining <= 0) return <span className="rounded-lg bg-gray-200 px-3 py-1 text-xs font-medium text-gray-600">ক্যাম্পেইন শেষ</span>;

  const hrs = Math.floor(remaining / 3_600_000);
  const mins = Math.floor((remaining % 3_600_000) / 60_000);
  const secs = Math.floor((remaining % 60_000) / 1000);

  return (
    <div className="flex items-center gap-2 text-sm">
      <Clock className="h-4 w-4 text-red-500" />
      <span className="text-gray-600">শেষ হবে:</span>
      {[['ঘণ্টা', hrs], ['মিনিট', mins], ['সেকেন্ড', secs]].map(([label, value]) => (
        <span key={String(label)} className="flex flex-col items-center">
          <span className="min-w-9 rounded-md bg-ink-900 px-1.5 py-0.5 text-center text-sm font-bold text-white tnum">{String(value).padStart(2, '0')}</span>
          <span className="mt-0.5 text-[10px] text-gray-500">{label}</span>
        </span>
      ))}
    </div>
  );
}
