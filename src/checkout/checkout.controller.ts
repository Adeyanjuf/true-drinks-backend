import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiQuery,
  ApiHeader,
  ApiBadRequestResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CheckoutService } from './checkout.service';
import { CreatePaymentIntentDto, QuoteDto } from './dto/checkout.dto';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ApiResponse } from '../common/response/api-response';
import { ApiEnvelope } from '../common/response/api-response.doc';

@ApiTags('checkout')
@ApiBearerAuth('access-token')
@ApiHeader({
  name: 'x-cart-token',
  required: false,
  description: 'Guest cart token (not needed when logged in)',
})
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('checkout')
export class CheckoutController {
  constructor(
    private readonly checkoutService: CheckoutService,
    private readonly orders: OrdersService,
  ) {}

  @Post('quote')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalJwtGuard)
  @ApiOperation({
    summary:
      'Price the cart: subtotal, promo discount, total weight, shipping band and total (pence)',
  })
  @ApiEnvelope('Quote', {
    promoCode: 'SUMMER10',
    totalWeightGrams: 2400,
    shippingBand: { label: '2kg – 5kg', pricePence: 699 },
    requiresAgeVerification: true,
    subtotalPence: 4320,
    discountPence: 432,
    shippingPence: 699,
    totalPence: 4587,
  })
  @ApiBadRequestResponse({
    description:
      'Empty cart, invalid/expired promo, or order over the weight limit',
  })
  @ApiConflictResponse({ description: 'Cart contains out-of-stock items' })
  async quote(
    @GetUser() user: { id: string } | null,
    @Headers('x-cart-token') token: string | undefined,
    @Body() dto: QuoteDto,
  ) {
    return ApiResponse.success(
      await this.checkoutService.quote(
        { userId: user?.id, token },
        dto.promoCode,
      ),
    );
  }

  @Post('payment-intent')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalJwtGuard)
  @ApiOperation({
    summary:
      'Validate the cart, run the age check, price it on the server and create a Stripe PaymentIntent. The order is created only after Stripe confirms payment.',
  })
  @ApiEnvelope('Use clientSecret with Stripe Elements `confirmPayment`', {
    clientSecret: 'pi_..._secret_...',
    paymentIntentId: 'pi_...',
    totalWeightGrams: 2400,
    shippingBand: { label: '2kg – 5kg', pricePence: 699 },
    promoCode: null,
    subtotalPence: 4320,
    discountPence: 0,
    shippingPence: 699,
    totalPence: 5019,
  })
  @ApiBadRequestResponse({
    description: 'Validation error, empty cart, bad promo, missing/invalid DOB',
  })
  @ApiForbiddenResponse({
    description:
      'Customer is under 18 (cart has age-restricted items); nothing is charged',
  })
  @ApiConflictResponse({ description: 'Cart contains out-of-stock items' })
  async createPaymentIntent(
    @GetUser() user: { id: string } | null,
    @Headers('x-cart-token') token: string | undefined,
    @Body() dto: CreatePaymentIntentDto,
  ) {
    return ApiResponse.success(
      await this.checkoutService.createPaymentIntent(
        { userId: user?.id, token },
        dto,
      ),
    );
  }

  @Get('result')
  @ApiOperation({
    summary:
      'Poll after confirming payment: PROCESSING, PAID (with trackingId) or FAILED',
  })
  @ApiQuery({ name: 'paymentIntentId', example: 'pi_3Abc...' })
  @ApiEnvelope('Result', { status: 'PAID', trackingId: 'DRK-7QK2M-X9H4T' })
  async result(@Query('paymentIntentId') paymentIntentId: string) {
    return ApiResponse.success(
      await this.orders.resultForPaymentIntent(paymentIntentId),
    );
  }
}
