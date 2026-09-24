import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(config: ConfigService) {
    const key = config.getOrThrow<string>('STRIPE_SECRET_KEY');
    if (!/^(sk|rk)_(test|live)_/.test(key)) {
      throw new Error(
        'STRIPE_SECRET_KEY does not look like a Stripe secret key',
      );
    }
    this.logger.log(
      `Stripe running in ${key.includes('_test_') ? 'TEST' : 'LIVE'} mode`,
    );
    this.stripe = new Stripe(key);
    this.webhookSecret = config.getOrThrow<string>('STRIPE_WEBHOOK_SECRET');
  }

  createPaymentIntent(
    params: Stripe.PaymentIntentCreateParams,
    idempotencyKey: string,
  ): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.create(params, { idempotencyKey });
  }

  retrievePaymentIntent(id: string): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.retrieve(id);
  }

  cancelPaymentIntent(id: string): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.cancel(id);
  }

  refund(paymentIntentId: string): Promise<Stripe.Refund> {
    return this.stripe.refunds.create({ payment_intent: paymentIntentId });
  }

  /** Verifies the Stripe-Signature header against the raw request body. */
  constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      this.webhookSecret,
    );
  }
}
