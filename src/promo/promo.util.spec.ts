import { BadRequestException } from '@nestjs/common';
import {
  assertPromoApplicable,
  promoDiscountPence,
  PromoRules,
} from './promo.util';

const base: PromoRules = {
  code: 'TEST',
  type: 'PERCENT',
  value: 10,
  minSpendPence: 0,
  expiresAt: null,
  usageLimit: null,
  usedCount: 0,
  isActive: true,
};

describe('promoDiscountPence', () => {
  it('calculates percentage discounts', () => {
    expect(promoDiscountPence({ type: 'PERCENT', value: 10 }, 4320)).toBe(432);
  });
  it('uses fixed amounts but never exceeds the subtotal', () => {
    expect(promoDiscountPence({ type: 'FIXED', value: 500 }, 4320)).toBe(500);
    expect(promoDiscountPence({ type: 'FIXED', value: 5000 }, 4320)).toBe(4320);
  });
});

describe('assertPromoApplicable', () => {
  it('accepts a valid promo', () => {
    expect(() => assertPromoApplicable(base, 1000)).not.toThrow();
  });
  it.each([
    ['inactive', { isActive: false }],
    ['expired', { expiresAt: new Date('2020-01-01') }],
    ['used up', { usageLimit: 5, usedCount: 5 }],
    ['below minimum spend', { minSpendPence: 2000 }],
  ])('rejects a promo that is %s', (_name, override) => {
    expect(() => assertPromoApplicable({ ...base, ...override }, 1000)).toThrow(
      BadRequestException,
    );
  });
});
