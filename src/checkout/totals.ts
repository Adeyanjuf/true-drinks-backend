import { ShippingBand } from './shipping.config';

export interface Totals {
  subtotalPence: number;
  discountPence: number;
  shippingPence: number;
  totalPence: number;
}

/** subtotal - promo discount + shipping (shipping is never discounted). */
export function calculateTotals(
  subtotalPence: number,
  discountPence: number,
  band: Pick<ShippingBand, 'pricePence'>,
): Totals {
  return {
    subtotalPence,
    discountPence,
    shippingPence: band.pricePence,
    totalPence: subtotalPence - discountPence + band.pricePence,
  };
}
