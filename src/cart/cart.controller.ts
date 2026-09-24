import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CartService } from './cart.service';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ApiResponse } from '../common/response/api-response';
import {
  ApiEnvelope,
  ApiUnauthorized,
} from '../common/response/api-response.doc';

const cartExample = {
  cartId: 'cuid',
  token: 'guest-cart-token (null for logged-in users)',
  items: [
    {
      productId: 'cuid',
      name: 'Jameson 70cl',
      quantity: 2,
      unitPricePence: 2160,
      lineTotalPence: 4320,
      weightGrams: 1200,
      isAgeRestricted: true,
      stock: 5,
      available: true,
    },
  ],
  itemCount: 2,
  subtotalPence: 4320,
  totalWeightGrams: 2400,
  requiresAgeVerification: true,
  hasUnavailableItems: false,
};

const CartTokenHeader = () =>
  ApiHeader({
    name: 'x-cart-token',
    required: false,
    description:
      'Guest cart token, returned as `token` by GET /cart. Not needed when logged in (Authorization header).',
  });

interface AuthUser {
  id: string;
}

// Cart calls are chatty, so they get a higher limit than the global default.
@ApiTags('cart')
@ApiBearerAuth('access-token')
@CartTokenHeader()
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @UseGuards(OptionalJwtGuard)
  @ApiOperation({
    summary:
      'Get the cart (creates a guest cart and returns its token if none is supplied)',
  })
  @ApiEnvelope('Priced cart', cartExample)
  async get(
    @GetUser() user: AuthUser | null,
    @Headers('x-cart-token') token?: string,
  ) {
    return ApiResponse.success(
      await this.cartService.getCart({ userId: user?.id, token }),
    );
  }

  @Post('items')
  @UseGuards(OptionalJwtGuard)
  @ApiOperation({
    summary:
      'Add a product to the cart (quantities add up; checked against stock)',
  })
  @ApiEnvelope('Updated cart', cartExample, 'Item added')
  async add(
    @GetUser() user: AuthUser | null,
    @Headers('x-cart-token') token: string | undefined,
    @Body() dto: AddCartItemDto,
  ) {
    return ApiResponse.success(
      await this.cartService.addItem(
        { userId: user?.id, token },
        dto.productId,
        dto.quantity,
      ),
      'Item added',
    );
  }

  @Patch('items/:productId')
  @UseGuards(OptionalJwtGuard)
  @ApiOperation({ summary: 'Set the quantity of a cart item (0 removes it)' })
  @ApiEnvelope('Updated cart', cartExample, 'Cart updated')
  async update(
    @GetUser() user: AuthUser | null,
    @Headers('x-cart-token') token: string | undefined,
    @Param('productId') productId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return ApiResponse.success(
      await this.cartService.setQuantity(
        { userId: user?.id, token },
        productId,
        dto.quantity,
      ),
      'Cart updated',
    );
  }

  @Delete('items/:productId')
  @UseGuards(OptionalJwtGuard)
  @ApiOperation({ summary: 'Remove an item from the cart' })
  @ApiEnvelope('Updated cart', cartExample, 'Item removed')
  async remove(
    @GetUser() user: AuthUser | null,
    @Headers('x-cart-token') token: string | undefined,
    @Param('productId') productId: string,
  ) {
    return ApiResponse.success(
      await this.cartService.removeItem({ userId: user?.id, token }, productId),
      'Item removed',
    );
  }

  @Delete()
  @UseGuards(OptionalJwtGuard)
  @ApiOperation({ summary: 'Empty the cart' })
  @ApiEnvelope('Empty cart', cartExample, 'Cart cleared')
  async clear(
    @GetUser() user: AuthUser | null,
    @Headers('x-cart-token') token?: string,
  ) {
    return ApiResponse.success(
      await this.cartService.clear({ userId: user?.id, token }),
      'Cart cleared',
    );
  }

  @Post('merge')
  @UseGuards(JwtGuard)
  @ApiUnauthorized()
  @ApiOperation({
    summary:
      'After login: merge the guest cart (x-cart-token) into the account cart',
  })
  @ApiEnvelope('Merged account cart', cartExample, 'Carts merged')
  async merge(
    @GetUser() user: AuthUser,
    @Headers('x-cart-token') token?: string,
  ) {
    return ApiResponse.success(
      token
        ? await this.cartService.merge(user.id, token)
        : await this.cartService.getCart({ userId: user.id }),
      'Carts merged',
    );
  }
}
