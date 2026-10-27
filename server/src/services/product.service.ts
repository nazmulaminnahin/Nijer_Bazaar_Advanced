import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql, SQL } from 'drizzle-orm';
import { db } from '../config/db';
import type { DbClient } from '../config/db';
import { categories, flashSales, productImages, products } from '../schemas/index';
import { applyPromoPrice } from './pricing';

export interface ProductFilters {
  search?: string;
  categoryId?: number;
  categorySlug?: string;
  featured?: boolean;
  newArrival?: boolean;
  flashSale?: boolean;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  includeInactive?: boolean;
  sort?: 'newest' | 'price-asc' | 'price-desc' | 'popular' | 'rating';
  page: number;
  limit: number;
}

export interface ProductDto {
  id: number;
  name: string;
  slug: string;
  sku: string;
  shortDescription: string | null;
  description: string | null;
  categoryId: number | null;
  categoryName: string | null;
  price: number;
  salePrice: number | null;
  effectivePrice: number;
  comparePrice: number | null;
  stock: number;
  lowStockThreshold: number;
  rating: number;
  reviewCount: number;
  totalSold: number;
  isActive: boolean;
  isFeatured: boolean;
  isNewArrival: boolean;
  flashSale: { id: number; title: string; endsAt: string; promoPrice: number } | null;
  images: string[];
  mainImage: string | null;
  createdAt: string;
}

function activeFlashSales(dbc: DbClient, now = new Date()) {
  return dbc
    .select()
    .from(flashSales)
    .where(and(eq(flashSales.isActive, true), sql`${flashSales.startAt} <= ${now}`, sql`${flashSales.endAt} >= ${now}`));
}

export function priceOf(row: { price: string; salePrice: string | null }): number {
  const sale = row.salePrice == null ? null : Number(row.salePrice);
  const base = Number(row.price);
  return sale != null && sale > 0 && sale < base ? sale : base;
}

/** Serialises a product row + images + any live flash-sale promotion. */
export function toProductDto(
  row: typeof products.$inferSelect,
  images: Array<{ imageUrl: string; isMain: boolean }>,
  categoryName: string | null,
  promos: Array<{ id: number; title: string; type: string; value: string; endAt: Date; productIds: number[]; categoryIds: number[] }>
): ProductDto {
  const basePrice = Number(row.price);
  const salePrice = row.salePrice == null ? null : Number(row.salePrice);
  const regular = priceOf({ price: row.price, salePrice: row.salePrice });

  const matching = promos.filter(
    (p) =>
      p.productIds?.includes(row.id) ||
      (row.categoryId != null && p.categoryIds?.includes(row.categoryId))
  );
  const promo = matching.length
    ? matching.reduce((best, cur) => {
        const bestPrice = applyPromoPrice(regular, [{ type: cur.type as 'percentage' | 'flat', value: Number(cur.value) }]);
        const currentBest = applyPromoPrice(regular, [{ type: best.type as 'percentage' | 'flat', value: Number(best.value) }]);
        return bestPrice < currentBest ? cur : best;
      })
    : null;

  const effectivePrice = promo
    ? applyPromoPrice(regular, [{ type: promo.type as 'percentage' | 'flat', value: Number(promo.value) }])
    : regular;

  const sortedImages = [...images].sort((a, b) => Number(b.isMain) - Number(a.isMain));
  const imageUrls = sortedImages.map((i) => i.imageUrl);

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    sku: row.sku,
    shortDescription: row.shortDescription,
    description: row.description,
    categoryId: row.categoryId,
    categoryName,
    price: basePrice,
    salePrice,
    effectivePrice,
    comparePrice: effectivePrice < basePrice ? basePrice : salePrice,
    stock: row.stock,
    lowStockThreshold: row.lowStockThreshold,
    rating: Number(row.rating),
    reviewCount: row.reviewCount,
    totalSold: row.totalSold,
    isActive: row.isActive,
    isFeatured: row.isFeatured,
    isNewArrival: row.isNewArrival,
    flashSale: promo
      ? { id: promo.id, title: promo.title, endsAt: promo.endAt.toISOString(), promoPrice: effectivePrice }
      : null,
    images: imageUrls,
    mainImage: imageUrls[0] ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listProducts(filters: ProductFilters, dbc: DbClient = db) {
  const conditions: SQL[] = [];
  if (!filters.includeInactive) conditions.push(eq(products.isActive, true));
  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(
      or(ilike(products.name, term), ilike(products.sku, term), ilike(products.shortDescription, term))!
    );
  }
  if (filters.categoryId) conditions.push(eq(products.categoryId, filters.categoryId));
  if (filters.categorySlug) {
    const [cat] = await dbc.select({ id: categories.id }).from(categories).where(eq(categories.slug, filters.categorySlug)).limit(1);
    conditions.push(eq(products.categoryId, cat?.id ?? -1));
  }
  if (filters.featured) conditions.push(eq(products.isFeatured, true));
  if (filters.newArrival) conditions.push(eq(products.isNewArrival, true));
  if (filters.inStock) conditions.push(sql`${products.stock} > 0`);
  if (filters.minPrice != null) conditions.push(sql`coalesce(${products.salePrice}, ${products.price}) >= ${filters.minPrice}`);
  if (filters.maxPrice != null) conditions.push(sql`coalesce(${products.salePrice}, ${products.price}) <= ${filters.maxPrice}`);

  const where = conditions.length ? and(...conditions) : undefined;

  const orderBy = (() => {
    switch (filters.sort) {
      case 'price-asc': return [asc(sql`coalesce(${products.salePrice}, ${products.price})`)] as const;
      case 'price-desc': return [desc(sql`coalesce(${products.salePrice}, ${products.price})`)] as const;
      case 'popular': return [desc(products.totalSold)] as const;
      case 'rating': return [desc(products.rating)] as const;
      default: return [desc(products.createdAt)] as const;
    }
  })();

  const [totalRow] = await dbc.select({ value: count() }).from(products).where(where);
  let rows = await dbc
    .select()
    .from(products)
    .where(where)
    .orderBy(...orderBy)
    .limit(filters.limit)
    .offset((filters.page - 1) * filters.limit);

  const promos = await activeFlashSales(dbc);

  // `flashSale=true` only returns products that currently have a live promotion.
  if (filters.flashSale) {
    const ids = new Set(promos.flatMap((p) => p.productIds ?? []));
    const cats = new Set(promos.flatMap((p) => p.categoryIds ?? []));
    rows = rows.filter((r) => ids.has(r.id) || (r.categoryId != null && cats.has(r.categoryId)));
  }

  const ids = rows.map((r) => r.id);
  const imgs = ids.length
    ? await dbc.select().from(productImages).where(inArray(productImages.productId, ids))
    : [];
  const cats = await dbc.select({ id: categories.id, name: categories.name }).from(categories);
  const catName = (id: number | null) => cats.find((c) => c.id === id)?.name ?? null;

  const data = rows.map((row) =>
    toProductDto(
      row,
      imgs.filter((i) => i.productId === row.id).map((i) => ({ imageUrl: i.imageUrl, isMain: i.isMain })),
      catName(row.categoryId),
      promos as any
    )
  );

  const total = filters.flashSale ? data.length : Number(totalRow?.value ?? 0);
  return {
    data,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / filters.limit)),
    },
  };
}

export async function getProductDetail(identifier: string, dbc: DbClient = db) {
  const numeric = Number(identifier);
  const [row] = await dbc
    .select()
    .from(products)
    .where(Number.isInteger(numeric) && numeric > 0 ? or(eq(products.id, numeric), eq(products.slug, identifier))! : eq(products.slug, identifier))
    .limit(1);
  if (!row) return null;
  const images = await dbc.select().from(productImages).where(eq(productImages.productId, row.id));
  const promos = await activeFlashSales(dbc);
  const [cat] = row.categoryId
    ? await dbc.select({ name: categories.name }).from(categories).where(eq(categories.id, row.categoryId)).limit(1)
    : [];
  return toProductDto(
    row,
    images.map((i) => ({ imageUrl: i.imageUrl, isMain: i.isMain })),
    cat?.name ?? null,
    promos as any
  );
}

/** Replaces product images atomically. First image becomes the main image. */
export async function replaceProductImages(dbc: DbClient, productId: number, urls: string[]) {
  const clean = urls.map((u) => u.trim()).filter(Boolean).slice(0, 8);
  await dbc.delete(productImages).where(eq(productImages.productId, productId));
  if (!clean.length) return;
  await dbc.insert(productImages).values(
    clean.map((url, index) => ({ productId, imageUrl: url, isMain: index === 0, sortOrder: index }))
  );
}

export async function nextProductSku(dbc: DbClient = db): Promise<string> {
  const [row] = await dbc.select({ value: count() }).from(products);
  return `NB-${String(1000 + Number(row?.value ?? 0) + 1)}`;
}

export function bulkUpdateStockStatement(productId: number, quantity: number) {
  return { productId, quantity };
}
