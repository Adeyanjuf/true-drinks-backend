import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PromoService } from './promo.service';

const makePrisma = (promo: object | null, updateCount: number) => {
  const updateMany = jest.fn().mockResolvedValue({ count: updateCount });
  const prisma = {
    promoCode: { findUnique: jest.fn().mockResolvedValue(promo), updateMany },
  } as unknown as PrismaService;
  return { service: new PromoService(prisma), updateMany };
};

describe('PromoService.reserve', () => {
  it('guards the increment with the usage limit', async () => {
    const { service, updateMany } = makePrisma({ id: 'p1', usageLimit: 3 }, 1);
    await service.reserve('CODE');
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', usedCount: { lt: 3 } },
      data: { usedCount: { increment: 1 } },
    });
  });

  it('does not guard codes with no limit', async () => {
    const { service, updateMany } = makePrisma(
      { id: 'p1', usageLimit: null },
      1,
    );
    await service.reserve('CODE');
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { usedCount: { increment: 1 } },
    });
  });

  it('refuses when the last redemption was already taken', async () => {
    const { service } = makePrisma({ id: 'p1', usageLimit: 1 }, 0);
    await expect(service.reserve('CODE')).rejects.toThrow(BadRequestException);
  });

  it('rejects unknown codes', async () => {
    const { service } = makePrisma(null, 0);
    await expect(service.reserve('NOPE')).rejects.toThrow(BadRequestException);
  });
});

describe('PromoService.release', () => {
  it('decrements but never below zero', async () => {
    const { service, updateMany } = makePrisma(null, 1);
    await service.release('CODE');
    expect(updateMany).toHaveBeenCalledWith({
      where: { code: 'CODE', usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  });
});
