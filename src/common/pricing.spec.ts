import { finalPricePence, withFinalPrice } from './pricing';

describe('finalPricePence', () => {
  it('returns the list price when there is no discount', () => {
    expect(finalPricePence(1899, 0)).toBe(1899);
  });
  it('applies a percentage discount and rounds to the nearest penny', () => {
    expect(finalPricePence(2400, 10)).toBe(2160);
    expect(finalPricePence(999, 15)).toBe(849); // 849.15
    expect(finalPricePence(101, 50)).toBe(51); // 50.5 rounds up
  });
  it('is free at 100%', () => {
    expect(finalPricePence(500, 100)).toBe(0);
  });
  it('adds finalPricePence to an object', () => {
    expect(
      withFinalPrice({ pricePence: 1000, discountPercent: 25 }).finalPricePence,
    ).toBe(750);
  });
});
