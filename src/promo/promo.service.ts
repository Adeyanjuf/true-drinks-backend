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
}
