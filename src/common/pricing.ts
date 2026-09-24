// All money is stored and computed as integer pence.
export const finalPricePence = (pricePence: number, discountPercent: number) =>
  Math.round((pricePence * (100 - discountPercent)) / 100);

export const withFinalPrice = <
  T extends { pricePence: number; discountPercent: number },
>(
  p: T,
) => ({
  ...p,
  finalPricePence: finalPricePence(p.pricePence, p.discountPercent),
});
