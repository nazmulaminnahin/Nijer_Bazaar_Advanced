/**
 * Pure pricing rules — no database access, fully unit-testable.
 * Both the storefront quote endpoint and order creation use these functions,
 * so the advertised shipping policy can never disagree with the checkout.
 */

export type ShippingZoneCode = 'inside_dhaka' | 'outside_dhaka';

export interface ZoneConfig {
  code: string;
  name: string;
  charge: number;
  freeShippingEligible: boolean;
  freeShippingThreshold: number | null;
  districts: string[];
}

export interface ShippingConfig {
  /** Master switch from admin settings. When false no order ever ships free. */
  freeShippingEnabled: boolean;
  /** Fallback threshold used when a zone does not define its own. */
  freeShippingThreshold: number;
  /** Which zone(s) may receive free delivery. */
  freeShippingScope: 'inside_dhaka' | 'all';
  zones: ZoneConfig[];
  /** Charge used when the address matches no configured zone. */
  defaultCharge: number;
}

export interface ShippingQuote {
  zoneCode: string;
  zoneName: string;
  charge: number;
  baseCharge: number;
  freeShippingApplied: boolean;
  freeShippingThreshold: number | null;
  reason: string;
}

export const DEFAULT_SHIPPING_CONFIG: ShippingConfig = {
  freeShippingEnabled: true,
  freeShippingThreshold: 999,
  freeShippingScope: 'inside_dhaka',
  defaultCharge: 120,
  zones: [
    {
      code: 'inside_dhaka',
      name: 'ঢাকার ভিতরে',
      charge: 60,
      freeShippingEligible: true,
      freeShippingThreshold: 999,
      districts: ['dhaka'],
    },
    {
      code: 'outside_dhaka',
      name: 'ঢাকার বাইরে',
      charge: 120,
      freeShippingEligible: false,
      freeShippingThreshold: null,
      districts: ['*'],
    },
  ],
};

export function normalizeDistrict(district: string): string {
  return String(district ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function findZone(config: ShippingConfig, district: string): ZoneConfig {
  const target = normalizeDistrict(district);
  const zones = config.zones.filter((z) => z.code !== '*' && !z.districts.includes('*'));
  const match = zones.find((z) => z.districts.some((d) => normalizeDistrict(d) === target));
  if (match) return match;
  const fallback = config.zones.find((z) => z.districts.includes('*'));
  if (fallback) return fallback;
  return {
    code: 'default',
    name: 'ডেলিভারি',
    charge: config.defaultCharge,
    freeShippingEligible: false,
    freeShippingThreshold: null,
    districts: ['*'],
  };
}

/**
 * Shipping charge for a cart subtotal.
 * Free shipping requires ALL of: feature enabled, zone eligible for the
 * configured scope, zone eligible flag, and subtotal >= threshold.
 */
export function quoteShipping(input: {
  district: string;
  subtotal: number;
  config: ShippingConfig;
}): ShippingQuote {
  const { config } = input;
  const subtotal = Math.max(0, Number(input.subtotal) || 0);
  const zone = findZone(config, input.district);
  const baseCharge = Math.max(0, Number(zone.charge) || 0);

  // The admin setting is authoritative: editing it in Settings must change
  // checkout behaviour without any code change.
  const threshold = Number(config.freeShippingThreshold);

  // Scope "all" makes every zone eligible; "inside_dhaka" restricts free
  // delivery to the Dhaka zone (and still requires the zone's own flag).
  const eligible =
    config.freeShippingEnabled &&
    (config.freeShippingScope === 'all' ||
      (zone.code === 'inside_dhaka' && zone.freeShippingEligible)) &&
    Number.isFinite(threshold);

  if (!eligible) {
    const reason = !config.freeShippingEnabled
      ? 'Free shipping is currently disabled.'
      : `${zone.name} অঞ্চলে ফ্রি ডেলিভারি প্রযোজ্য নয়।`;
    return {
      zoneCode: zone.code,
      zoneName: zone.name,
      charge: baseCharge,
      baseCharge,
      freeShippingApplied: false,
      freeShippingThreshold: null,
      reason,
    };
  }

  if (subtotal >= threshold) {
    return {
      zoneCode: zone.code,
      zoneName: zone.name,
      charge: 0,
      baseCharge,
      freeShippingApplied: true,
      freeShippingThreshold: threshold,
      reason: `৳${threshold} বা তার বেশি অর্ডারে ফ্রি ডেলিভারি প্রযোজ্য হয়েছে।`,
    };
  }

  return {
    zoneCode: zone.code,
    zoneName: zone.name,
    charge: baseCharge,
    baseCharge,
    freeShippingApplied: false,
    freeShippingThreshold: threshold,
    reason: `ফ্রি ডেলিভারির জন্য আরও ৳${Math.ceil(threshold - subtotal)} যোগ করুন।`,
  };
}

export interface DiscountRule {
  type: 'percentage' | 'flat' | 'free_shipping';
  value: number;
  maxDiscountAmount?: number | null;
  minOrderAmount?: number | null;
}

/** Coupon discount in taka, never negative and never above the subtotal. */
export function computeDiscount(rule: DiscountRule, subtotal: number): number {
  const base = Math.max(0, Number(subtotal) || 0);
  const min = rule.minOrderAmount == null ? 0 : Number(rule.minOrderAmount);
  if (base < min) return 0;
  if (rule.type === 'free_shipping') return 0;

  let discount = 0;
  if (rule.type === 'percentage') {
    discount = Math.floor((base * Math.max(0, Number(rule.value) || 0)) / 100);
    if (rule.maxDiscountAmount != null) {
      discount = Math.min(discount, Number(rule.maxDiscountAmount));
    }
  } else {
    discount = Math.max(0, Number(rule.value) || 0);
  }
  return Math.max(0, Math.min(Math.round(discount), Math.round(base)));
}

export interface OrderTotalsInput {
  items: Array<{ price: number; quantity: number }>;
  shippingCharge: number;
  discount: number;
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  itemCount: number;
}

/** Authoritative server-side totals. Clamps every value to a sane range. */
export function computeOrderTotals(input: OrderTotalsInput): OrderTotals {
  const itemCount = input.items.reduce((sum, i) => sum + Math.max(0, Math.floor(i.quantity)), 0);
  const subtotal = Math.round(
    input.items.reduce((sum, i) => sum + Math.max(0, Number(i.price)) * Math.max(0, Math.floor(i.quantity)), 0)
  );
  const discount = Math.min(Math.max(0, Math.round(input.discount)), subtotal);
  const shipping = Math.max(0, Math.round(input.shippingCharge));
  return {
    subtotal,
    discount,
    shipping,
    total: Math.max(0, subtotal - discount + shipping),
    itemCount,
  };
}

/** Flash-sale / promotional price, deterministic: best (lowest) price wins. */
export function applyPromoPrice(basePrice: number, promos: Array<{ type: 'percentage' | 'flat'; value: number }>): number {
  const base = Math.max(0, Number(basePrice) || 0);
  if (!promos.length) return base;
  const prices = promos.map((p) => {
    if (p.type === 'percentage') return Math.round(base - (base * Math.max(0, Number(p.value) || 0)) / 100);
    return Math.round(base - Math.max(0, Number(p.value) || 0));
  });
  return Math.max(1, Math.min(base, ...prices));
}
