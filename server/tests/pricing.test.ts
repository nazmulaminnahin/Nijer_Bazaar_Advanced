import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SHIPPING_CONFIG, computeDiscount, computeOrderTotals, quoteShipping, applyPromoPrice,
  type ShippingConfig,
} from '../src/services/pricing';

const config: ShippingConfig = DEFAULT_SHIPPING_CONFIG;

describe('shipping thresholds', () => {
  const cases: Array<[string, number, number, boolean]> = [
    ['inside Dhaka, below threshold', 998, 60, false],
    ['inside Dhaka, exactly at threshold', 999, 0, true],
    ['inside Dhaka, above threshold', 2500, 0, true],
    ['outside Dhaka, below threshold', 998, 120, false],
    ['outside Dhaka, above threshold', 2500, 120, false],
  ];

  it.each(cases)('%s', (_label, subtotal, charge, freeApplied) => {
    const district = _label.startsWith('inside') ? 'Dhaka' : 'Chattogram';
    const quote = quoteShipping({ district, subtotal, config });
    expect(quote.charge).toBe(charge);
    expect(quote.freeShippingApplied).toBe(freeApplied);
  });

  it('reports the exact remaining amount needed for free shipping', () => {
    const quote = quoteShipping({ district: 'dhaka', subtotal: 500, config });
    expect(quote.reason).toContain('499');
  });

  it('honours the admin-enabled flag', () => {
    const quote = quoteShipping({ district: 'Dhaka', subtotal: 5000, config: { ...config, freeShippingEnabled: false } });
    expect(quote.charge).toBe(60);
    expect(quote.freeShippingApplied).toBe(false);
  });

  it('honours an edited threshold (configurable, no code change)', () => {
    const edited = { ...config, freeShippingThreshold: 2000 };
    expect(quoteShipping({ district: 'Dhaka', subtotal: 1500, config: edited }).charge).toBe(60);
    expect(quoteShipping({ district: 'Dhaka', subtotal: 2000, config: edited }).charge).toBe(0);
  });

  it('can extend free shipping to all zones when configured', () => {
    const all = { ...config, freeShippingScope: 'all' as const };
    expect(quoteShipping({ district: 'Chattogram', subtotal: 1500, config: all }).charge).toBe(0);
  });

  it('falls back to the wildcard zone for unknown districts', () => {
    const quote = quoteShipping({ district: 'Nowhere', subtotal: 100, config });
    expect(quote.zoneCode).toBe('outside_dhaka');
    expect(quote.charge).toBe(120);
  });
});

describe('discounts', () => {
  it('computes percentage discounts with a cap', () => {
    expect(computeDiscount({ type: 'percentage', value: 10, maxDiscountAmount: 300 }, 2000)).toBe(200);
    expect(computeDiscount({ type: 'percentage', value: 20, maxDiscountAmount: 300 }, 5000)).toBe(300);
  });

  it('never exceeds the subtotal', () => {
    expect(computeDiscount({ type: 'flat', value: 500 }, 200)).toBe(200);
  });

  it('returns zero below the minimum order amount', () => {
    expect(computeDiscount({ type: 'flat', value: 100, minOrderAmount: 1000 }, 999)).toBe(0);
  });

  it('treats free-shipping coupons as zero product discount', () => {
    expect(computeDiscount({ type: 'free_shipping', value: 0 }, 1500)).toBe(0);
  });
});

describe('order totals', () => {
  it('never produces negative totals', () => {
    const totals = computeOrderTotals({ items: [{ price: 100, quantity: 1 }], shippingCharge: 60, discount: 500 });
    expect(totals.discount).toBe(100);
    expect(totals.total).toBe(60);
    expect(totals.total).toBeGreaterThanOrEqual(0);
  });

  it('rounds to whole taka consistently', () => {
    const totals = computeOrderTotals({ items: [{ price: 333.33, quantity: 3 }], shippingCharge: 0, discount: 0 });
    expect(totals.subtotal).toBe(1000);
  });
});

describe('promo pricing', () => {
  it('uses the best (lowest) price when campaigns overlap', () => {
    expect(applyPromoPrice(1000, [{ type: 'percentage', value: 10 }, { type: 'flat', value: 300 }])).toBe(700);
  });
});
