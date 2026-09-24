import { MAX_ORDER_WEIGHT_GRAMS, shippingBandFor } from './shipping.config';

describe('shippingBandFor', () => {
  it('uses the lowest band that fits, inclusive of the boundary', () => {
    expect(shippingBandFor(1)?.maxGrams).toBe(2_000);
    expect(shippingBandFor(2_000)?.maxGrams).toBe(2_000);
    expect(shippingBandFor(2_001)?.maxGrams).toBe(5_000);
  });
  it('accepts the maximum weight and rejects anything heavier', () => {
    expect(shippingBandFor(MAX_ORDER_WEIGHT_GRAMS)).not.toBeNull();
    expect(shippingBandFor(MAX_ORDER_WEIGHT_GRAMS + 1)).toBeNull();
  });
});
