import { calculateTotals } from './totals';

describe('calculateTotals', () => {
  it('adds shipping after the discount and never discounts shipping', () => {
    expect(calculateTotals(4320, 432, { pricePence: 699 })).toEqual({
      subtotalPence: 4320,
      discountPence: 432,
      shippingPence: 699,
      totalPence: 4587,
    });
  });
  it('works with no discount', () => {
    expect(calculateTotals(1000, 0, { pricePence: 499 }).totalPence).toBe(1499);
  });
});
