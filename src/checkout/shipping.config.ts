// PLACEHOLDER prices: confirm with the client before launch. Bands are by total order weight.
export interface ShippingBand {
  maxGrams: number;
  label: string;
  pricePence: number;
}

export const SHIPPING_BANDS: ShippingBand[] = [
  { maxGrams: 2_000, label: 'Up to 2kg', pricePence: 499 },
  { maxGrams: 5_000, label: '2kg – 5kg', pricePence: 699 },
  { maxGrams: 10_000, label: '5kg – 10kg', pricePence: 999 },
  { maxGrams: 20_000, label: '10kg – 20kg', pricePence: 1499 },
];

export const MAX_ORDER_WEIGHT_GRAMS =
  SHIPPING_BANDS[SHIPPING_BANDS.length - 1].maxGrams;

/** The band an order of this weight ships in, or null if it is too heavy for any band. */
export function shippingBandFor(weightGrams: number): ShippingBand | null {
  return SHIPPING_BANDS.find((b) => weightGrams <= b.maxGrams) ?? null;
}
