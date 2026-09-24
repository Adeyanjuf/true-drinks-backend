import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { PromoModule } from '../promo/promo.module';
import { OrdersModule } from '../orders/orders.module';
import { StripeModule } from '../stripe/stripe.module';
import {
  AgeVerificationService,
  DobSelfDeclaredProvider,
} from './age-verification';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

@Module({
  imports: [AuthModule, CartModule, PromoModule, OrdersModule, StripeModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, AgeVerificationService, DobSelfDeclaredProvider],
  exports: [CheckoutService],
})
export class CheckoutModule {}
