import { Totals } from './totals';

export interface SnapshotItem {
  productId: string;
  name: string;
  listPricePence: number;
  discountPercent: number;
  unitPricePence: number;
  weightGrams: number;
  quantity: number;
  isAgeRestricted: boolean;
}

/** What we promise the customer, frozen when the PaymentIntent is created. */
export interface CheckoutSnapshot {
  cartId: string;
  userId: string | null;
  name: string;
  email: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    postcode: string;
    phone: string;
  };
  promoCode: string | null;
  items: SnapshotItem[];
  totals: Totals;
  totalWeightGrams: number;
}
