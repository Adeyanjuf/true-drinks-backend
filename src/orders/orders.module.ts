import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QueuesModule } from '../queues/queues.module';
import { StripeModule } from '../stripe/stripe.module';
import {
  AdminOrdersController,
  CustomerOrdersController,
  TrackingController,
} from './orders.controller';
import { OrdersReconcileService } from './orders-reconcile.service';
import { OrdersService } from './orders.service';
import { StripeWebhookController } from './stripe-webhook.controller';

@Module({
  imports: [AuthModule, QueuesModule, StripeModule],
  controllers: [
    AdminOrdersController,
    CustomerOrdersController,
    TrackingController,
    StripeWebhookController,
  ],
  providers: [OrdersService, OrdersReconcileService],
  exports: [OrdersService],
})
export class OrdersModule {}
