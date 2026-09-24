import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { OrdersService } from './orders.service';

const MINUTE = 60_000;

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
            await this.prisma.pendingCheckout.delete({ where: { id: p.id } });
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
        } else if (pi.status === 'canceled') {
          await this.prisma.pendingCheckout.delete({ where: { id: p.id } });
        } else if (p.createdAt < new Date(Date.now() - 24 * 60 * MINUTE)) {
          await this.stripe.cancelPaymentIntent(pi.id);
          await this.prisma.pendingCheckout.delete({ where: { id: p.id } });
        }
      } catch (e) {
        this.logger.error(
          `Reconcile failed for pending ${p.id}: ${(e as Error).message}`,
        );
      }
    }
  }
}
