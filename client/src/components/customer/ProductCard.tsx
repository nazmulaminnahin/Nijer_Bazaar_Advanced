import { Link } from 'react-router-dom';
import { Heart, ShoppingCart, Star } from 'lucide-react';
import { useState } from 'react';
import { mediaUrl, api, getApiErrorMessage } from '@/lib/api';
import { taka } from '@/lib/format';
import { useCart } from '@/store/cart';
import { useAuth } from '@/store/auth';
import { toast } from '@/lib/toast';
import { SmartImage } from '@/components/ui';
import { cn } from '@/lib/utils';

export interface ProductDTO {
  id: number;
  name: string;
  slug: string;
  sku: string;
  effectivePrice: number;
  price: number;
  salePrice: number | null;
  comparePrice: number | null;
  stock: number;
  rating: number;
  reviewCount: number;
  images: string[];
  mainImage: string | null;
  isNewArrival?: boolean;
  flashSale?: { id: number; title: string; endsAt: string; promoPrice: number } | null;
  categoryName?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  categoryId?: number | null;
}

export function ProductCard({ product, wished = false }: { product: ProductDTO; wished?: boolean }) {
  const addItem = useCart((s) => s.add);
  const token = useAuth((s) => s.token);
  const [wishlisted, setWishlisted] = useState(wished);
  const [busy, setBusy] = useState(false);

  const discount =
    product.comparePrice && product.comparePrice > product.effectivePrice
      ? Math.round(((product.comparePrice - product.effectivePrice) / product.comparePrice) * 100)
      : 0;

  const addToCart = () => {
    if (product.stock <= 0) return;
    addItem({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      price: product.effectivePrice,
      stock: product.stock,
      image: product.mainImage,
      sku: product.sku,
    });
    toast.success('কার্টে যোগ করা হয়েছে');
  };

  const toggleWishlist = async () => {
    if (!token) {
      toast.info('উইশলিস্টে যোগ করতে অনুগ্রহ করে লগইন করুন');
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

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:border-brand-200 hover:shadow-pop">
      <Link to={`/product/${product.slug}`} className="relative block aspect-square overflow-hidden bg-gray-50">
        <SmartImage src={mediaUrl(product.mainImage)} alt={product.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {discount > 0 && <span className="rounded-md bg-red-500 px-1.5 py-0.5 text-[11px] font-bold text-white">-{discount}%</span>}
          {product.flashSale && <span className="rounded-md bg-amber-500 px-1.5 py-0.5 text-[11px] font-bold text-white">ফ্ল্যাশ সেল</span>}
          {!product.flashSale && product.isNewArrival && <span className="rounded-md bg-emerald-500 px-1.5 py-0.5 text-[11px] font-bold text-white">নতুন</span>}
        </div>
        {product.stock <= 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <span className="rounded-md bg-ink-900 px-3 py-1 text-xs font-semibold text-white">স্টক শেষ</span>
          </div>
        )}
      </Link>

      <button
        onClick={toggleWishlist}
        disabled={busy}
        aria-label={wishlisted ? 'উইশলিস্ট থেকে সরান' : 'উইশলিস্টে যোগ করুন'}
        aria-pressed={wishlisted}
        className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-gray-500 shadow-sm transition hover:text-red-500"
      >
        <Heart className={cn('h-4 w-4', wishlisted && 'fill-red-500 text-red-500')} />
      </button>

      <div className="flex flex-1 flex-col p-3">
        {product.categoryName && <p className="mb-0.5 truncate text-[11px] uppercase tracking-wide text-gray-400">{product.categoryName}</p>}
        <Link to={`/product/${product.slug}`} className="line-clamp-2 text-sm font-medium leading-snug text-ink-900 hover:text-brand-600">
          {product.name}
        </Link>

        <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          <span>{product.rating.toFixed(1)}</span>
          {product.reviewCount > 0 && <span>({product.reviewCount})</span>}
        </div>

        <div className="mt-auto pt-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold text-brand-600 tnum">{taka(product.effectivePrice)}</span>
            {product.comparePrice && product.comparePrice > product.effectivePrice && (
              <span className="text-xs text-gray-400 line-through tnum">{taka(product.comparePrice)}</span>
            )}
          </div>
          <button
            onClick={addToCart}
            disabled={product.stock <= 0}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-50 py-2 text-xs font-semibold text-brand-700 transition hover:bg-brand-500 hover:text-white disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
          >
            <ShoppingCart className="h-3.5 w-3.5" /> কার্টে যোগ করুন
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="aspect-square animate-pulse bg-gray-100" />
      <div className="space-y-2 p-3">
        <div className="h-3 w-1/3 animate-pulse rounded bg-gray-100" />
        <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100" />
        <div className="h-8 w-full animate-pulse rounded bg-gray-100" />
      </div>
    </div>
  );
}
