import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { OrdersService } from './orders.service';

const MINUTE = 60_000;
// Unpaid checkouts hold promo redemptions, so they are released fairly quickly.
const ABANDON_AFTER_MINUTES = 120;

/**
 * Safety net for "no payment without an order": if a webhook was lost, a succeeded
 * PaymentIntent is picked up here. Also purges abandoned checkouts (which hold PII).
 */
@Injectable()
export class OrdersReconcileService {
  private readonly logger = new Logger(OrdersReconcileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly orders: OrdersService,
  ) {}

  @Cron('*/10 * * * *')
  async reconcile() {
    const pendings = await this.prisma.pendingCheckout.findMany({
      where: {
        status: 'CREATED',
        createdAt: { lt: new Date(Date.now() - 15 * MINUTE) },
      },
      take: 50,
    });

    for (const p of pendings) {
      try {
        if (!p.stripePaymentIntentId) {
          if (p.createdAt < new Date(Date.now() - 60 * MINUTE)) {
            await this.orders.abandonPending(p);
          }
          continue;
        }

        const pi = await this.stripe.retrievePaymentIntent(
          p.stripePaymentIntentId,
        );
        if (pi.status === 'succeeded') {
          this.logger.warn(
            `Recovering order for succeeded PaymentIntent ${pi.id}`,
          );
          await this.orders.createFromPaymentIntent(pi);
        } else if (
          pi.status === 'canceled' ||
          p.createdAt < new Date(Date.now() - ABANDON_AFTER_MINUTES * MINUTE)
        ) {
          // Also releases the reserved promo redemption.
          await this.orders.abandonPending(p);
        }
      } catch (e) {
        this.logger.error(
          `Reconcile failed for pending ${p.id}: ${(e as Error).message}`,
        );
      }
    }
  }
}
