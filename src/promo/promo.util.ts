import { BadRequestException } from '@nestjs/common';

export interface PromoRules {
  code: string;
  type: 'PERCENT' | 'FIXED';
  value: number;
  minSpendPence: number;
  expiresAt: Date | null;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
}

/** Throws a user-facing BadRequest if the promo can't be applied to this subtotal. */
export function assertPromoApplicable(
  promo: PromoRules,
  subtotalPence: number,
  now = new Date(),
) {
  if (!promo.isActive)
    throw new BadRequestException('This promo code is not active');
  if (promo.expiresAt && promo.expiresAt < now) {
    throw new BadRequestException('This promo code has expired');
  }
  if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
    throw new BadRequestException(
      'This promo code has reached its usage limit',
    );
  }
  if (subtotalPence < promo.minSpendPence) {
    throw new BadRequestException(
      `Spend at least £${(promo.minSpendPence / 100).toFixed(2)} to use this promo code`,
    );
  }
}

/** Discount in pence; applies to the item subtotal only and never exceeds it. */
export function promoDiscountPence(
  promo: Pick<PromoRules, 'type' | 'value'>,
  subtotalPence: number,
) {
  const raw =
    promo.type === 'PERCENT'
      ? Math.round((subtotalPence * promo.value) / 100)
      : promo.value;
  return Math.min(raw, subtotalPence);
}
