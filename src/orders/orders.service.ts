import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { EmailQueue } from '../queues/email.queue';
import { CheckoutSnapshot } from '../checkout/checkout.types';
import { OrderQueryDto } from './dto/order.dto';
import {
  NOTIFIABLE_STATUSES,
  canTransition,
  customerStatusText,
  nextStatus,
} from './order-status';
import { generateTrackingId, normaliseTrackingId } from './tracking-id';

class OutOfStockError extends Error {}
class AlreadyProcessedError extends Error {}

const orderInclude = { items: true } as const;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly emailQueue: EmailQueue,
  ) {}

  /**
   * Turns a succeeded PaymentIntent into an Order. Idempotent: Stripe retries webhooks and
   * the reconcile job may race them, so a second call for the same PaymentIntent is a no-op.
   */
  async createFromPaymentIntent(pi: Stripe.PaymentIntent) {
    const existing = await this.prisma.order.findUnique({
      where: { stripePaymentIntentId: pi.id },
    });
    if (existing) return existing;

    const pendingId = pi.metadata?.pendingCheckoutId;
    const pending = pendingId
      ? await this.prisma.pendingCheckout.findUnique({
          where: { id: pendingId },
        })
      : null;
    if (!pending) {
      this.logger.warn(
        `PaymentIntent ${pi.id} has no matching pending checkout; ignoring`,
      );
      return null;
    }
    if (pending.status !== 'CREATED') return null;

    const snap = pending.snapshot as unknown as CheckoutSnapshot;
    if (pi.amount !== snap.totals.totalPence || pi.currency !== 'gbp') {
      this.logger.error(
        `Amount mismatch on ${pi.id}: paid ${pi.amount} ${pi.currency}, expected ${snap.totals.totalPence} gbp. Refunding.`,
      );
      await this.failAndRefund(pending, snap, pi.id);
      return null;
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const { order, lowStockProductIds } = await this.prisma.$transaction(
          (tx) => this.createOrderTx(tx, pending.id, pi.id, snap, pending),
        );
        await this.notifyReceipt(order.id);
        await this.notifyLowStock(lowStockProductIds);
        this.logger.log(
          `Order ${order.trackingId} created for PaymentIntent ${pi.id}`,
        );
        return order;
      } catch (e) {
        if (e instanceof OutOfStockError) {
          this.logger.error(
            `Out of stock while fulfilling ${pi.id}; refunding`,
          );
          await this.failAndRefund(pending, snap, pi.id);
          return null;
        }
        if (e instanceof AlreadyProcessedError) {
          return this.prisma.order.findUnique({
            where: { stripePaymentIntentId: pi.id },
          });
        }
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          // Duplicate PaymentIntent => another worker won; duplicate trackingId => retry.
          const won = await this.prisma.order.findUnique({
            where: { stripePaymentIntentId: pi.id },
          });
          if (won) return won;
          continue;
        }
        throw e;
      }
    }
    throw new Error(`Could not generate a unique tracking ID for ${pi.id}`);
  }

  private async createOrderTx(
    tx: Prisma.TransactionClient,
    pendingId: string,
    paymentIntentId: string,
    snap: CheckoutSnapshot,
    pending: { ageVerifiedAt: Date | null; ageMethod: string | null },
  ) {
    // Claim the pending row first: a concurrent worker updates 0 rows and backs off.
    const claimed = await tx.pendingCheckout.updateMany({
      where: { id: pendingId, status: 'CREATED' },
      data: { status: 'COMPLETED', snapshot: {} },
    });
    if (claimed.count === 0) throw new AlreadyProcessedError();

    const lowStockProductIds: string[] = [];
    for (const item of snap.items) {
      const res = await tx.product.updateMany({
        where: { id: item.productId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (res.count === 0) throw new OutOfStockError();

      // Warn the admin only when this order pushes the product across its threshold.
      const after = await tx.product.findUnique({
        where: { id: item.productId },
        select: { stock: true, lowStockThreshold: true },
      });
      if (
        after &&
        after.stock <= after.lowStockThreshold &&
        after.stock + item.quantity > after.lowStockThreshold
      ) {
        lowStockProductIds.push(item.productId);
      }
    }

    // The promo redemption was already reserved when the PaymentIntent was created.

    const order = await tx.order.create({
      data: {
        trackingId: generateTrackingId(),
        userId: snap.userId,
        email: snap.email,
        name: snap.name,
        addressLine1: snap.address.line1,
        addressLine2: snap.address.line2,
        city: snap.address.city,
        postcode: snap.address.postcode,
        phone: snap.address.phone,
        subtotalPence: snap.totals.subtotalPence,
        discountPence: snap.totals.discountPence,
        shippingPence: snap.totals.shippingPence,
        totalPence: snap.totals.totalPence,
        totalWeightGrams: snap.totalWeightGrams,
        promoCode: snap.promoCode,
        stripePaymentIntentId: paymentIntentId,
        ageVerifiedAt: pending.ageVerifiedAt,
        ageMethod: pending.ageMethod,
        items: {
          create: snap.items.map((i) => ({
            productId: i.productId,
            name: i.name,
            listPricePence: i.listPricePence,
            discountPercent: i.discountPercent,
            unitPricePence: i.unitPricePence,
            weightGrams: i.weightGrams,
            quantity: i.quantity,
            isAgeRestricted: i.isAgeRestricted,
          })),
        },
        history: { create: { toStatus: 'PACKAGING' } },
      },
    });

    await tx.cartItem.deleteMany({ where: { cartId: snap.cartId } });
    return { order, lowStockProductIds };
  }

  private async failAndRefund(
    pending: { id: string; promoReserved: boolean },
    snap: CheckoutSnapshot,
    paymentIntentId: string,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const res = await tx.pendingCheckout.updateMany({
        where: { id: pending.id, status: 'CREATED' },
        data: { status: 'FAILED', snapshot: {} },
      });
      // No order will exist, so the reserved promo redemption goes back to the pool.
      if (res.count > 0 && pending.promoReserved && snap.promoCode) {
        await tx.promoCode.updateMany({
          where: { code: snap.promoCode, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        });
      }
    });
    try {
      await this.stripe.refund(paymentIntentId);
    } catch (e) {
      // Needs a human: money was taken but no order exists.
      this.logger.error(
        `REFUND FAILED for ${paymentIntentId}: ${(e as Error).message}`,
      );
    }
  }

  private async notifyLowStock(productIds: string[]) {
    if (productIds.length === 0) return;
    try {
      await this.emailQueue.sendLowStockAlert(productIds);
    } catch (e) {
      this.logger.error(
        `Could not queue low-stock alert: ${(e as Error).message}`,
      );
    }
  }

  /**
   * Cancels an unpaid checkout: cancels its PaymentIntent, frees the reserved promo
   * redemption and deletes the snapshot. If the payment actually went through in the
   * meantime, the order is created instead.
   */
  async abandonPending(pending: {
    id: string;
    stripePaymentIntentId: string | null;
    promoReserved: boolean;
    snapshot: unknown;
  }) {
    if (pending.stripePaymentIntentId) {
      const pi = await this.stripe.retrievePaymentIntent(
        pending.stripePaymentIntentId,
      );
      if (pi.status === 'succeeded') {
        await this.createFromPaymentIntent(pi);
        return;
      }
      if (pi.status !== 'canceled')
        await this.stripe.cancelPaymentIntent(pi.id);
    }

    const snap = pending.snapshot as CheckoutSnapshot;
    await this.prisma.$transaction(async (tx) => {
      const del = await tx.pendingCheckout.deleteMany({
        where: { id: pending.id, status: 'CREATED' },
      });
      if (del.count > 0 && pending.promoReserved && snap.promoCode) {
        await tx.promoCode.updateMany({
          where: { code: snap.promoCode, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        });
      }
    });
  }

  /** A customer restarting checkout supersedes their earlier unpaid attempts on the same cart. */
  async abandonStaleForCart(cartId: string) {
    const stale = await this.prisma.pendingCheckout.findMany({
      where: {
        status: 'CREATED',
        snapshot: { path: ['cartId'], equals: cartId },
      },
    });
    for (const p of stale) {
      try {
        await this.abandonPending(p);
      } catch (e) {
        this.logger.warn(
          `Could not abandon earlier checkout ${p.id}: ${(e as Error).message}`,
        );
      }
    }
  }

  private async notifyReceipt(orderId: string) {
    try {
      await this.emailQueue.sendOrderReceipt(orderId);
    } catch (e) {
      this.logger.error(
        `Could not queue receipt email for ${orderId}: ${(e as Error).message}`,
      );
    }
  }

  // ---------- reads used by checkout / customers ----------

  async resultForPaymentIntent(paymentIntentId: string) {
    const order = await this.prisma.order.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
      select: { trackingId: true },
    });
    if (order) return { status: 'PAID' as const, trackingId: order.trackingId };

    const pending = await this.prisma.pendingCheckout.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
      select: { status: true },
    });
    if (!pending) throw new NotFoundException('Payment not found');
    return {
      status:
        pending.status === 'FAILED'
          ? ('FAILED' as const)
          : ('PROCESSING' as const),
    };
  }

  listMine(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: orderInclude,
    });
  }

  async track(rawTrackingId: string) {
    const order = await this.prisma.order.findUnique({
      where: { trackingId: normaliseTrackingId(rawTrackingId) },
      include: { history: { orderBy: { changedAt: 'asc' } } },
    });
    if (!order)
      throw new NotFoundException('No order found for that tracking ID');

    // Deliberately no name, email or address here: the ID alone grants access.
    return {
      trackingId: order.trackingId,
      status: order.status,
      ...customerStatusText[order.status],
      placedAt: order.createdAt,
      timeline: order.history.map((h) => ({
        status: h.toStatus,
        title: customerStatusText[h.toStatus].title,
        at: h.changedAt,
      })),
    };
  }

  // ---------- admin ----------

  async listAdmin(q: OrderQueryDto) {
    const where: Prisma.OrderWhereInput = {
      ...(q.status && { status: q.status }),
      ...(q.search && {
        OR: [
          { trackingId: { contains: q.search.toUpperCase() } },
          { email: { contains: q.search, mode: 'insensitive' } },
          { name: { contains: q.search, mode: 'insensitive' } },
        ],
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: orderInclude,
      }),
      this.prisma.order.count({ where }),
    ]);
    return {
      items,
      meta: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages: Math.ceil(total / q.limit),
      },
    };
  }

  async findAdmin(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        history: {
          orderBy: { changedAt: 'asc' },
          include: {
            changedBy: { select: { id: true, email: true, name: true } },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async updateStatus(id: string, to: OrderStatus, adminId: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');

    if (!canTransition(order.status, to)) {
      const next = nextStatus(order.status);
      throw new ConflictException(
        next
          ? `Cannot move an order from ${order.status} to ${to}. The next status is ${next}.`
          : `This order is already ${order.status}; its status can't change further.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Guarded write: two admins clicking at once can't both apply the same step.
      const res = await tx.order.updateMany({
        where: { id, status: order.status },
        data: { status: to },
      });
      if (res.count === 0) {
        throw new ConflictException(
          'The order status was changed by someone else. Refresh and retry.',
        );
      }
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: order.status,
          toStatus: to,
          changedById: adminId,
        },
      });
    });

    if (NOTIFIABLE_STATUSES.includes(to)) {
      try {
        await this.emailQueue.sendOrderStatus(id, to);
      } catch (e) {
        this.logger.error(
          `Could not queue ${to} email for ${id}: ${(e as Error).message}`,
        );
      }
    }
    return this.findAdmin(id);
  }
}
