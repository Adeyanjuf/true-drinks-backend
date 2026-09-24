import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { AgeVerificationService } from './age-verification';
import { CheckoutSnapshot } from './checkout.types';
import { CreatePaymentIntentDto } from './dto/checkout.dto';
import { CartContext, CartService } from '../cart/cart.service';
import { PromoService } from '../promo/promo.service';
import { MAX_ORDER_WEIGHT_GRAMS, shippingBandFor } from './shipping.config';
import { calculateTotals } from './totals';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly cartService: CartService,
    private readonly promoService: PromoService,
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly ageVerification: AgeVerificationService,
  ) {}

  /** Prices the caller's cart: stock check, promo, weight and shipping band. */
  async quote(ctx: CartContext, promoCode?: string) {
    const cart = await this.cartService.getCart(ctx);

    if (cart.items.length === 0)
      throw new BadRequestException('Your cart is empty');
    if (cart.hasUnavailableItems) {
      throw new ConflictException(
        'Some items are out of stock or exceed available stock. Update your cart and try again.',
      );
    }

    const band = shippingBandFor(cart.totalWeightGrams);
    if (!band) {
      throw new BadRequestException(
        `This order weighs ${(cart.totalWeightGrams / 1000).toFixed(1)}kg, above our ${MAX_ORDER_WEIGHT_GRAMS / 1000}kg limit. Please split it into multiple orders.`,
      );
    }

    const promo = promoCode
      ? await this.promoService.apply(promoCode, cart.subtotalPence)
      : null;
    const totals = calculateTotals(
      cart.subtotalPence,
      promo?.discountPence ?? 0,
      band,
    );

    return {
      cart,
      promoCode: promo?.code ?? null,
      totalWeightGrams: cart.totalWeightGrams,
      shippingBand: { label: band.label, pricePence: band.pricePence },
      requiresAgeVerification: cart.requiresAgeVerification,
      ...totals,
    };
  }

  /**
   * Validates everything server-side, freezes the price into a PendingCheckout and creates the
   * PaymentIntent. No Order exists until Stripe confirms payment (see OrdersService).
   */
  async createPaymentIntent(ctx: CartContext, dto: CreatePaymentIntentDto) {
    const quote = await this.quote(ctx, dto.promoCode);

    // Runs before any PaymentIntent exists, so a failed check means no charge and no order.
    const age = quote.requiresAgeVerification
      ? await this.ageVerification.assertOldEnough(dto.dob)
      : null;

    const snapshot: CheckoutSnapshot = {
      cartId: quote.cart.cartId,
      userId: ctx.userId ?? null,
      name: dto.name,
      email: dto.email,
      address: {
        line1: dto.address.line1,
        line2: dto.address.line2,
        city: dto.address.city,
        postcode: dto.address.postcode,
        phone: dto.address.phone,
      },
      promoCode: quote.promoCode,
      items: quote.cart.items.map((i) => ({
        productId: i.productId,
        name: i.name,
        listPricePence: i.listPricePence,
        discountPercent: i.discountPercent,
        unitPricePence: i.unitPricePence,
        weightGrams: i.weightGrams,
        quantity: i.quantity,
        isAgeRestricted: i.isAgeRestricted,
      })),
      totals: {
        subtotalPence: quote.subtotalPence,
        discountPence: quote.discountPence,
        shippingPence: quote.shippingPence,
        totalPence: quote.totalPence,
      },
      totalWeightGrams: quote.totalWeightGrams,
    };

    const pending = await this.prisma.pendingCheckout.create({
      data: {
        snapshot: snapshot as unknown as Prisma.InputJsonObject,
        ageVerifiedAt: age ? new Date() : null,
        ageMethod: age?.method ?? null,
      },
    });

    try {
      const pi = await this.stripe.createPaymentIntent(
        {
          amount: quote.totalPence,
          currency: 'gbp',
          automatic_payment_methods: { enabled: true },
          metadata: { pendingCheckoutId: pending.id },
        },
        `pending-${pending.id}`,
      );
      await this.prisma.pendingCheckout.update({
        where: { id: pending.id },
        data: { stripePaymentIntentId: pi.id },
      });

      return {
        clientSecret: pi.client_secret,
        paymentIntentId: pi.id,
        totalWeightGrams: quote.totalWeightGrams,
        shippingBand: quote.shippingBand,
        promoCode: quote.promoCode,
        subtotalPence: quote.subtotalPence,
        discountPence: quote.discountPence,
        shippingPence: quote.shippingPence,
        totalPence: quote.totalPence,
      };
    } catch (e) {
      await this.prisma.pendingCheckout
        .delete({ where: { id: pending.id } })
        .catch(() => undefined);
      this.logger.error(
        `Stripe PaymentIntent creation failed: ${(e as Error).message}`,
      );
      throw new BadGatewayException(
        'Payment provider error. Please try again.',
      );
    }
  }
}
