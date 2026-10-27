import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X, Search, LayoutGrid, List } from 'lucide-react';
import { api } from '@/lib/api';
import { ProductCard, ProductCardSkeleton, type ProductDTO } from '@/components/customer/ProductCard';
import { Button, EmptyState, ErrorState, Input, Pagination, Select, SmartImage, Badge } from '@/components/ui';
import { mediaUrl } from '@/lib/api';
import { taka } from '@/lib/format';
import { Link } from 'react-router-dom';

interface Category { id: number; name: string; nameBn?: string | null; slug: string }

const SORTS = [
  { value: 'newest', label: 'নতুন আগে' },
  { value: 'price-asc', label: 'দাম: কম থেকে বেশি' },
  { value: 'price-desc', label: 'দাম: বেশি থেকে কম' },
  { value: 'popular', label: 'জনপ্রিয়তা' },
  { value: 'rating', label: 'রেটিং' },
];

export default function ShopPage() {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(params.get('search') ?? '');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const page = Number(params.get('page') ?? 1);
  const search = params.get('search') ?? '';
  const category = params.get('category') ?? '';
  const sort = params.get('sort') ?? 'newest';
  const minPrice = params.get('minPrice') ?? '';
  const maxPrice = params.get('maxPrice') ?? '';
  const inStock = params.get('inStock') === 'true';
  const flashSale = params.get('flashSale') === 'true';

  const update = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([key, value]) => {
      if (!value) next.delete(key);
      else next.set(key, value);
    });
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  }, [params, setParams]);

  useEffect(() => {
    api.get('/categories').then((res) => setCategories(res.data.categories ?? [])).catch(() => undefined);
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    const query = new URLSearchParams({ page: String(page), limit: '12', sort });
    if (search) query.set('search', search);
    if (category) query.set('category', category);
    if (minPrice) query.set('minPrice', minPrice);
    if (maxPrice) query.set('maxPrice', maxPrice);
    if (inStock) query.set('inStock', 'true');
    if (flashSale) query.set('flashSale', 'true');

    api
      .get(`/products?${query.toString()}`)
      .then((res) => {
        if (!alive) return;
        setProducts(res.data.products ?? []);
        setPagination({
          page: res.data.pagination?.page ?? 1,
          totalPages: res.data.pagination?.totalPages ?? 1,
          total: res.data.pagination?.total ?? 0,
        });
      })
      .catch(() => alive && setError('পণ্য লোড করা যায়নি। আবার চেষ্টা করুন।'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [page, search, category, sort, minPrice, maxPrice, inStock, flashSale]);

  const activeFilters = useMemo(() => {
    const list: Array<{ key: string; label: string; value?: string }> = [];
    if (search) list.push({ key: 'search', label: `খোঁজ: ${search}` });
    if (category) list.push({ key: 'category', label: categories.find((c) => c.slug === category)?.nameBn || categories.find((c) => c.slug === category)?.name || category });
    if (minPrice) list.push({ key: 'minPrice', label: `সর্বনিম্ন ৳${minPrice}` });
    if (maxPrice) list.push({ key: 'maxPrice', label: `সর্বোচ্চ ৳${maxPrice}` });
    if (inStock) list.push({ key: 'inStock', label: 'স্টকে আছে' });
    if (flashSale) list.push({ key: 'flashSale', label: 'ফ্ল্যাশ সেল' });
    return list;
  }, [search, category, minPrice, maxPrice, inStock, flashSale, categories]);

  const FilterPanel = (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-semibold text-ink-900">ক্যাটাগরি</p>
        <div className="space-y-1">
          <button
            onClick={() => update({ category: null })}
            className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-sm ${!category ? 'bg-brand-50 font-medium text-brand-700' : 'text-ink-700 hover:bg-gray-50'}`}
          >
            সব ক্যাটাগরি
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => update({ category: c.slug })}
              className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-sm ${category === c.slug ? 'bg-brand-50 font-medium text-brand-700' : 'text-ink-700 hover:bg-gray-50'}`}
            >
              {c.nameBn || c.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-ink-900">দামের সীমা</p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            placeholder="সর্বনিম্ন"
            defaultValue={minPrice}
            onBlur={(e) => update({ minPrice: e.target.value })}
            aria-label="সর্বনিম্ন দাম"
          />
          <span className="text-gray-400">–</span>
          <Input
            type="number"
            min={0}
            placeholder="সর্বোচ্চ"
            defaultValue={maxPrice}
            onBlur={(e) => update({ maxPrice: e.target.value })}
            aria-label="সর্বোচ্চ দাম"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink-700">
        <input type="checkbox" checked={inStock} onChange={(e) => update({ inStock: e.target.checked ? 'true' : null })} className="h-4 w-4 rounded border-gray-300 text-brand-500" />
        শুধু স্টকে থাকা পণ্য
      </label>
      <label className="flex items-center gap-2 text-sm text-ink-700">
        <input type="checkbox" checked={flashSale} onChange={(e) => update({ flashSale: e.target.checked ? 'true' : null })} className="h-4 w-4 rounded border-gray-300 text-brand-500" />
        ফ্ল্যাশ সেলে থাকা পণ্য
      </label>

      <Button variant="outline" size="sm" className="w-full" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
        ফিল্টার রিসেট
      </Button>
    </div>
  );

  return (
    <div className="container-page py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900 sm:text-2xl">সব পণ্য</h1>
          <p className="text-sm text-gray-500">{pagination.total} টি পণ্য পাওয়া গেছে</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex">
            <form
              onSubmit={(e) => { e.preventDefault(); update({ search: searchInput }); }}
              className="flex overflow-hidden rounded-lg border border-gray-300"
            >
              <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="পণ্য খুঁজুন…" className="h-9 w-48 px-3 text-sm outline-none" aria-label="পণ্য খুঁজুন" />
              <button type="submit" className="bg-gray-100 px-3 text-gray-600 hover:bg-gray-200" aria-label="খুঁজুন"><Search className="h-4 w-4" /></button>
            </form>
          </div>
          <Select value={sort} onChange={(e) => update({ sort: e.target.value })} options={SORTS} className="h-9 w-40" aria-label="সাজান" />
          <div className="hidden items-center rounded-lg border border-gray-300 md:flex">
            <button onClick={() => setView('grid')} className={`p-1.5 ${view === 'grid' ? 'bg-brand-50 text-brand-700' : 'text-gray-500'}`} aria-label="গ্রিড ভিউ"><LayoutGrid className="h-4 w-4" /></button>
            <button onClick={() => setView('list')} className={`p-1.5 ${view === 'list' ? 'bg-brand-50 text-brand-700' : 'text-gray-500'}`} aria-label="লিস্ট ভিউ"><List className="h-4 w-4" /></button>
          </div>
          <Button variant="outline" size="sm" className="lg:hidden" icon={SlidersHorizontal} onClick={() => setFiltersOpen(true)}>ফিল্টার</Button>
        </div>
      </div>

      {activeFilters.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {activeFilters.map((f) => (
            <button key={f.key} onClick={() => update({ [f.key]: null })} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100">
              {f.label} <X className="h-3 w-3" />
            </button>
          ))}
          <button onClick={() => setParams(new URLSearchParams(), { replace: true })} className="text-xs text-gray-500 underline">সব মুছুন</button>
        </div>
      )}

      <div className="flex gap-6">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="card sticky top-32 p-4">{FilterPanel}</div>
        </aside>

        <div className="min-w-0 flex-1">
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={() => setParams(new URLSearchParams(params.toString()))} />
          ) : products.length === 0 ? (
            <EmptyState
              title="কোনো পণ্য পাওয়া যায়নি"
              description="ফিল্টার পরিবর্তন করে আবার চেষ্টা করুন।"
              action={<Button variant="outline" onClick={() => setParams(new URLSearchParams(), { replace: true })}>ফিল্টার রিসেট</Button>}
            />
          ) : view === 'grid' ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          ) : (
            <div className="space-y-3">
              {products.map((p) => (
                <div key={p.id} className="card flex gap-4 p-3">
                  <Link to={`/product/${p.slug}`} className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-gray-50">
                    <SmartImage src={mediaUrl(p.mainImage)} alt={p.name} className="h-full w-full object-cover" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link to={`/product/${p.slug}`} className="line-clamp-1 font-medium text-ink-900 hover:text-brand-600">{p.name}</Link>
                    <p className="line-clamp-2 text-xs text-gray-500">{p.shortDescription}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="font-bold text-brand-600 tnum">{taka(p.effectivePrice)}</span>
                      {p.comparePrice && p.comparePrice > p.effectivePrice && <span className="text-xs text-gray-400 line-through tnum">{taka(p.comparePrice)}</span>}
                      {p.stock <= 0 && <Badge tone="red">স্টক শেষ</Badge>}
                    </div>
                  </div>
                  <div className="hidden sm:block">
                    <ProductCard product={p} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={12} onChange={(p) => update({ page: String(p) })} />
        </div>
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-900/40" onClick={() => setFiltersOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] overflow-y-auto bg-white p-4 shadow-pop">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-semibold">ফিল্টার</p>
              <button onClick={() => setFiltersOpen(false)} aria-label="বন্ধ"><X className="h-5 w-5" /></button>
            </div>
            {FilterPanel}
          </div>
        </div>
      )}
    </div>
  );
}
