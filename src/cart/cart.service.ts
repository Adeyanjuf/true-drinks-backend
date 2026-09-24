import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { finalPricePence } from '../common/pricing';
import { MAX_LINE_QUANTITY } from './dto/cart.dto';

export interface CartContext {
  userId?: string;
  token?: string;
}

const cartInclude = {
  items: {
    include: { product: true },
    orderBy: { id: 'asc' },
  },
} as const;

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  /** Finds the caller's cart, creating one (guest or account) if it doesn't exist. */
  private async resolveCart(ctx: CartContext) {
    if (ctx.userId) {
      return (
        (await this.prisma.cart.findUnique({
          where: { userId: ctx.userId },
        })) ?? this.prisma.cart.create({ data: { userId: ctx.userId } })
      );
    }
    if (ctx.token) {
      const existing = await this.prisma.cart.findUnique({
        where: { token: ctx.token },
      });
      if (existing) return existing;
    }
    return this.prisma.cart.create({
      data: { token: crypto.randomBytes(24).toString('hex') },
    });
  }

  async getCart(ctx: CartContext) {
    const cart = await this.resolveCart(ctx);
    return this.view(cart.id);
  }

  /** Cart as a priced view; every read revalidates price and stock. */
  async view(cartId: string) {
    const cart = await this.prisma.cart.findUniqueOrThrow({
      where: { id: cartId },
      include: cartInclude,
    });

    const lines = cart.items.map((item) => {
      const unit = finalPricePence(
        item.product.pricePence,
        item.product.discountPercent,
      );
      return {
        productId: item.productId,
        name: item.product.name,
        image: item.product.images[0] ?? null,
        quantity: item.quantity,
        listPricePence: item.product.pricePence,
        discountPercent: item.product.discountPercent,
        unitPricePence: unit,
        lineTotalPence: unit * item.quantity,
        weightGrams: item.product.weightGrams,
        isAgeRestricted: item.product.isAgeRestricted,
        stock: item.product.stock,
        available: item.product.stock >= item.quantity,
      };
    });

    return {
      cartId: cart.id,
      token: cart.token, // null for account carts
      items: lines,
      itemCount: lines.reduce((n, l) => n + l.quantity, 0),
      subtotalPence: lines.reduce((n, l) => n + l.lineTotalPence, 0),
      totalWeightGrams: lines.reduce(
        (n, l) => n + l.weightGrams * l.quantity,
        0,
      ),
      requiresAgeVerification: lines.some((l) => l.isAgeRestricted),
      hasUnavailableItems: lines.some((l) => !l.available),
    };
  }

  async addItem(ctx: CartContext, productId: string, quantity: number) {
    const cart = await this.resolveCart(ctx);
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } },
    });
    const newQuantity = (existing?.quantity ?? 0) + quantity;
    this.assertQuantity(product.stock, newQuantity, product.name);

    await this.prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId } },
      create: { cartId: cart.id, productId, quantity: newQuantity },
      update: { quantity: newQuantity },
    });
    return this.view(cart.id);
  }

  async setQuantity(ctx: CartContext, productId: string, quantity: number) {
    const cart = await this.resolveCart(ctx);
    if (quantity === 0) return this.removeItem(ctx, productId);

    const item = await this.prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } },
      include: { product: true },
    });
    if (!item) throw new NotFoundException('Item is not in the cart');
    this.assertQuantity(item.product.stock, quantity, item.product.name);

    await this.prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity },
    });
    return this.view(cart.id);
  }

  async removeItem(ctx: CartContext, productId: string) {
    const cart = await this.resolveCart(ctx);
    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id, productId },
    });
    return this.view(cart.id);
  }

  async clear(ctx: CartContext) {
    const cart = await this.resolveCart(ctx);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.view(cart.id);
  }

  /** Moves a guest cart into the account cart after login; quantities are clamped to stock. */
  async merge(userId: string, guestToken: string) {
    const userCart = await this.resolveCart({ userId });
    const guest = await this.prisma.cart.findUnique({
      where: { token: guestToken },
      include: { items: { include: { product: true } } },
    });
    if (!guest) return this.view(userCart.id);

    await this.prisma.$transaction(async (tx) => {
      for (const item of guest.items) {
        const existing = await tx.cartItem.findUnique({
          where: {
            cartId_productId: {
              cartId: userCart.id,
              productId: item.productId,
            },
          },
        });
        const merged = Math.min(
          (existing?.quantity ?? 0) + item.quantity,
          MAX_LINE_QUANTITY,
          item.product.stock,
        );
        if (merged < 1) continue;
        await tx.cartItem.upsert({
          where: {
            cartId_productId: {
              cartId: userCart.id,
              productId: item.productId,
            },
          },
          create: {
            cartId: userCart.id,
            productId: item.productId,
            quantity: merged,
          },
          update: { quantity: merged },
        });
      }
      await tx.cart.delete({ where: { id: guest.id } });
    });
    return this.view(userCart.id);
  }

  private assertQuantity(stock: number, quantity: number, name: string) {
    if (quantity > MAX_LINE_QUANTITY) {
      throw new BadRequestException(
        `You can order at most ${MAX_LINE_QUANTITY} of "${name}"`,
      );
    }
    if (quantity > stock) {
      throw new BadRequestException(
        stock === 0
          ? `"${name}" is out of stock`
          : `Only ${stock} of "${name}" in stock`,
      );
    }
  }
}
