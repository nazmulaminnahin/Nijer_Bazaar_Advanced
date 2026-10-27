import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Heart, Minus, Plus, ShoppingCart, Star, Truck, ShieldCheck, RefreshCw, ChevronRight, Store,
} from 'lucide-react';
import { api, getApiErrorMessage, mediaUrl } from '@/lib/api';
import { taka } from '@/lib/format';
import { useCart } from '@/store/cart';
import { useAuth } from '@/store/auth';
import { toast } from '@/lib/toast';
import { Badge, Button, EmptyState, ErrorState, SmartImage, Spinner } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { ProductDTO } from '@/components/customer/ProductCard';

export default function ProductDetailPage() {
  const { slug = '' } = useParams();
  const [product, setProduct] = useState<ProductDTO | null>(null);
  const [related, setRelated] = useState<ProductDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [wishlisted, setWishlisted] = useState(false);
  const [busy, setBusy] = useState(false);
  const addItem = useCart((s) => s.add);
  const token = useAuth((s) => s.token);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/products/${slug}`);
      setProduct(res.data.product);
      setActiveImage(0);
      setQuantity(1);
      const cat = res.data.product.categoryId;
      if (cat) {
        const rel = await api.get(`/products?categoryId=${cat}&limit=4`);
        setRelated((rel.data.products ?? []).filter((p: ProductDTO) => p.id !== res.data.product.id).slice(0, 4));
      }
      if (token) {
        const ids = await api.get('/wishlist/ids').catch(() => null);
        setWishlisted(Boolean(ids?.data.productIds?.includes(res.data.product.id)));
      }
    } catch {
      setError('পণ্যটি পাওয়া যায়নি।');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug]);

  const toggleWishlist = async () => {
    if (!product) return;
    if (!token) {
      toast.info('উইশলিস্টে যোগ করতে লগইন করুন');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post(`/wishlist/${product.id}`);
      setWishlisted(Boolean(res.data.wishlisted));
      toast.success(res.data.message);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const addToCart = () => {
    if (!product) return;
    addItem(
      { productId: product.id, name: product.name, slug: product.slug, price: product.effectivePrice, stock: product.stock, image: product.mainImage, sku: product.sku },
      quantity
    );
    toast.success('কার্টে যোগ করা হয়েছে');
  };

  if (loading) return <Spinner className="py-24" />;
  if (error || !product) return <div className="container-page py-16"><ErrorState message={error ?? 'পণ্য পাওয়া যায়নি'} onRetry={load} /></div>;

  const discount = product.comparePrice && product.comparePrice > product.effectivePrice
    ? Math.round(((product.comparePrice - product.effectivePrice) / product.comparePrice) * 100)
    : 0;

  return (
    <div className="container-page py-6">
      <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
        <Link to="/" className="hover:text-brand-600">হোম</Link>
        <ChevronRight className="h-3 w-3" />
        <Link to="/shop" className="hover:text-brand-600">সব পণ্য</Link>
        {product.categoryName && (
          <>
            <ChevronRight className="h-3 w-3" />
            <span className="text-ink-700">{product.categoryName}</span>
          </>
        )}
        <ChevronRight className="h-3 w-3" />
        <span className="truncate text-ink-900">{product.name}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Gallery */}
        <div>
          <div className="card overflow-hidden p-2">
            <SmartImage src={mediaUrl(product.images[activeImage] ?? product.mainImage)} alt={product.name} className="aspect-square w-full rounded-lg object-cover" />
          </div>
          {product.images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {product.images.map((img, i) => (
                <button
                  key={`${img}-${i}`}
                  onClick={() => setActiveImage(i)}
                  className={cn('h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2', i === activeImage ? 'border-brand-500' : 'border-gray-200')}
                  aria-label={`ছবি ${i + 1}`}
                >
                  <SmartImage src={mediaUrl(img)} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {product.categoryName && <Badge tone="brand">{product.categoryName}</Badge>}
            {product.flashSale && <Badge tone="amber">ফ্ল্যাশ সেল</Badge>}
            {product.stock > 0 ? <Badge tone="green">স্টকে আছে ({product.stock})</Badge> : <Badge tone="red">স্টক শেষ</Badge>}
          </div>

          <h1 className="mt-2 text-2xl font-bold leading-snug text-ink-900">{product.name}</h1>

          <div className="mt-2 flex items-center gap-3 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span className="font-medium text-ink-900">{product.rating.toFixed(1)}</span>
              {product.reviewCount > 0 && <span>({product.reviewCount} রিভিউ)</span>}
            </span>
            <span>SKU: {product.sku}</span>
          </div>

          <div className="mt-4 flex flex-wrap items-baseline gap-3">
            <span className="text-3xl font-bold text-brand-600 tnum">{taka(product.effectivePrice)}</span>
            {product.comparePrice && product.comparePrice > product.effectivePrice && (
              <>
                <span className="text-lg text-gray-400 line-through tnum">{taka(product.comparePrice)}</span>
                <span className="rounded-md bg-red-50 px-2 py-0.5 text-sm font-semibold text-red-600">-{discount}%</span>
              </>
            )}
          </div>

          {product.shortDescription && <p className="mt-3 text-sm leading-relaxed text-gray-600">{product.shortDescription}</p>}

          {/* Quantity + actions */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-lg border border-gray-300">
              <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="p-2.5 text-gray-600 hover:bg-gray-50" aria-label="কমান"><Minus className="h-4 w-4" /></button>
              <input
                value={quantity}
                onChange={(e) => setQuantity(Math.min(product.stock || 99, Math.max(1, Number(e.target.value) || 1)))}
                className="h-10 w-12 border-x border-gray-300 text-center text-sm tnum outline-none"
                aria-label="পরিমাণ"
              />
              <button onClick={() => setQuantity((q) => Math.min(product.stock || 99, q + 1))} className="p-2.5 text-gray-600 hover:bg-gray-50" aria-label="বাড়ান"><Plus className="h-4 w-4" /></button>
            </div>
            <Button size="lg" icon={ShoppingCart} onClick={addToCart} disabled={product.stock <= 0}>কার্টে যোগ করুন</Button>
            <Button size="lg" variant="outline" onClick={toggleWishlist} loading={busy} aria-pressed={wishlisted}>
              <Heart className={cn('h-4 w-4', wishlisted && 'fill-red-500 text-red-500')} /> {wishlisted ? 'উইশলিস্টে আছে' : 'উইশলিস্ট'}
            </Button>
          </div>

          <div className="mt-5 grid gap-2 rounded-xl bg-gray-50 p-4 text-sm sm:grid-cols-2">
            <p className="flex items-center gap-2 text-ink-700"><Truck className="h-4 w-4 text-brand-600" /> ঢাকায় ২৪–৪৮ ঘণ্টায় ডেলিভারি</p>
            <p className="flex items-center gap-2 text-ink-700"><ShieldCheck className="h-4 w-4 text-brand-600" /> ১০০% অরিজিনাল পণ্য</p>
            <p className="flex items-center gap-2 text-ink-700"><RefreshCw className="h-4 w-4 text-brand-600" /> পণ্যে সমস্যা হলে বদল</p>
            <p className="flex items-center gap-2 text-ink-700"><Store className="h-4 w-4 text-brand-600" /> নিজের বাজার যাচাইকৃত সেলার</p>
          </div>

          {product.description && (
            <div className="mt-6">
              <h2 className="mb-2 text-base font-semibold text-ink-900">পণ্যের বিবরণ</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-gray-600">{product.description}</p>
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-bold text-ink-900">একই ধরনের পণ্য</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {related.map((p) => (
              <Link key={p.id} to={`/product/${p.slug}`} className="card overflow-hidden transition hover:shadow-pop">
                <SmartImage src={mediaUrl(p.mainImage)} alt={p.name} className="aspect-square w-full object-cover" />
                <div className="p-3">
                  <p className="line-clamp-2 text-sm font-medium text-ink-900">{p.name}</p>
                  <p className="mt-1 font-bold text-brand-600 tnum">{taka(p.effectivePrice)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
