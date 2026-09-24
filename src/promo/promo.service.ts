import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePromoDto, UpdatePromoDto } from './dto/promo.dto';
import { assertPromoApplicable, promoDiscountPence } from './promo.util';

@Injectable()
export class PromoService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const promo = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException('Promo code not found');
    return promo;
  }

  async create(dto: CreatePromoDto) {
    if (await this.prisma.promoCode.findUnique({ where: { code: dto.code } })) {
      throw new ConflictException('A promo code with this code already exists');
    }
    return this.prisma.promoCode.create({ data: dto });
  }

  async update(id: string, dto: UpdatePromoDto) {
    await this.findOne(id);
    if (dto.code) {
      const clash = await this.prisma.promoCode.findFirst({
        where: { code: dto.code, NOT: { id } },
      });
      if (clash)
        throw new ConflictException(
          'A promo code with this code already exists',
        );
    }
    return this.prisma.promoCode.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.promoCode.delete({ where: { id } });
  }

  /** Validates a customer-entered code against a subtotal; used by quote and checkout. */
  async apply(rawCode: string, subtotalPence: number) {
    const code = rawCode.trim().toUpperCase();
    const promo = await this.prisma.promoCode.findUnique({ where: { code } });
    if (!promo) throw new BadRequestException('Invalid promo code');
    assertPromoApplicable(promo, subtotalPence);
    return {
      code: promo.code,
      discountPence: promoDiscountPence(promo, subtotalPence),
    };
  }

  /**
   * Holds one redemption for a checkout that is about to take payment. The limit check is
   * atomic (guarded UPDATE), so the last remaining use can only go to one customer; anyone
   * who arrives after the limit is reached gets no discount and is told so.
   */
  async reserve(code: string) {
    const promo = await this.prisma.promoCode.findUnique({ where: { code } });
    if (!promo) throw new BadRequestException('Invalid promo code');

    const res = await this.prisma.promoCode.updateMany({
      where: {
        id: promo.id,
        ...(promo.usageLimit !== null && {
          usedCount: { lt: promo.usageLimit },
        }),
      },
      data: { usedCount: { increment: 1 } },
    });
    if (res.count === 0) {
      throw new BadRequestException(
        'This promo code has reached its usage limit',
      );
    }
  }

  /** Gives back a reserved redemption when a checkout is abandoned or fails. */
  async release(code: string) {
    await this.prisma.promoCode.updateMany({
      where: { code, usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  }
}
