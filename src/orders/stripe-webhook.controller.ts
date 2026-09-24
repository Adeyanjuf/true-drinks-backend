import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import Stripe from 'stripe';
import { StripeService } from '../stripe/stripe.service';
import { OrdersService } from './orders.service';

@ApiExcludeController()
@SkipThrottle()
@Controller('stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly stripe: StripeService,
    private readonly orders: OrdersService,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    if (!req.rawBody || !signature)
      throw new BadRequestException('Missing signature or body');

    let event: Stripe.Event;
    try {
      event = this.stripe.constructEvent(req.rawBody, signature);
    } catch {
      throw new BadRequestException('Invalid Stripe signature');
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        // Throwing here returns 500 so Stripe retries the webhook.
        await this.orders.createFromPaymentIntent(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        // The customer can retry with another card on the same PaymentIntent, so nothing to undo.
        this.logger.log(`Payment failed for ${event.data.object.id}`);
        break;
      default:
        break;
    }
    return { received: true };
  }
}
