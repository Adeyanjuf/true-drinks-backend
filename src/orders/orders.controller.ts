import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { OrdersService } from './orders.service';
import { OrderQueryDto, UpdateOrderStatusDto } from './dto/order.dto';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ApiResponse } from '../common/response/api-response';
import {
  ApiAdminOnly,
  ApiConflict,
  ApiEnvelope,
  ApiUnauthorized,
} from '../common/response/api-response.doc';

const orderExample = {
  id: 'cuid',
  trackingId: 'DRK-7QK2M-X9H4T',
  status: 'PACKAGING',
  name: 'John Doe',
  email: 'john@example.com',
  postcode: 'SW1A 2AA',
  subtotalPence: 4320,
  discountPence: 432,
  shippingPence: 699,
  totalPence: 4587,
  totalWeightGrams: 2400,
  items: [{ name: 'Jameson 70cl', quantity: 2, unitPricePence: 2160 }],
};

@ApiTags('orders')
@ApiBearerAuth('access-token')
@ApiAdminOnly()
@UseGuards(JwtGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @ApiOperation({
    summary: 'List all orders with status/search filters (admin)',
  })
  @ApiEnvelope('Paginated orders', {
    items: [orderExample],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  })
  async list(@Query() query: OrderQueryDto) {
    return ApiResponse.success(await this.orders.listAdmin(query));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Order detail with full status history (admin)' })
  @ApiEnvelope('Order', orderExample)
  async findOne(@Param('id') id: string) {
    return ApiResponse.success(await this.orders.findAdmin(id));
  }

  @Patch(':id/status')
  @ApiOperation({
    summary:
      'Advance the order status (admin). Only PACKAGING → OUT_FOR_DELIVERY → DELIVERED; emails the customer on the last two.',
  })
  @ApiConflict(
    'Cannot move an order from PACKAGING to DELIVERED. The next status is OUT_FOR_DELIVERY.',
  )
  @ApiEnvelope('Updated order', orderExample, 'Order status updated')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @GetUser() admin: { id: string },
  ) {
    return ApiResponse.success(
      await this.orders.updateStatus(id, dto.status, admin.id),
      'Order status updated',
    );
  }
}

@ApiTags('orders')
@Controller('orders')
export class CustomerOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiUnauthorized()
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Order history for the logged-in customer' })
  @ApiEnvelope('Orders, newest first', [orderExample])
  async mine(@GetUser() user: { id: string }) {
    return ApiResponse.success(await this.orders.listMine(user.id));
  }
}

@ApiTags('tracking')
@Controller('tracking')
export class TrackingController {
  constructor(private readonly orders: OrdersService) {}

  // Tight limit: the tracking ID is the only credential, so slow down guessing.
  @Get(':trackingId')
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Public order tracking by tracking ID (customer-friendly status, no personal data)',
  })
  @ApiEnvelope('Tracking info', {
    trackingId: 'DRK-7QK2M-X9H4T',
    status: 'OUT_FOR_DELIVERY',
    title: 'Out for delivery',
    description: 'Your order has left us and is on its way to you.',
    placedAt: '2026-09-24T10:00:00.000Z',
    timeline: [
      {
        status: 'PACKAGING',
        title: 'Order confirmed',
        at: '2026-09-24T10:00:00.000Z',
      },
    ],
  })
  async track(@Param('trackingId') trackingId: string) {
    return ApiResponse.success(await this.orders.track(trackingId));
  }
}
