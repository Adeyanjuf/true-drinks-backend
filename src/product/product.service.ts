import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { withFinalPrice } from '../common/pricing';
import {
  CreateProductDto,
  ProductQueryDto,
  UpdateProductDto,
} from './dto/product.dto';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(q: ProductQueryDto) {
    const where: Prisma.ProductWhereInput = {
      ...(q.categoryId && { categoryId: q.categoryId }),
      ...(q.category && { category: { slug: q.category } }),
      ...(q.brand && { brand: { equals: q.brand, mode: 'insensitive' } }),
      ...(q.inStock !== undefined && {
        stock: q.inStock ? { gt: 0 } : { equals: 0 },
      }),
      ...((q.minPrice !== undefined || q.maxPrice !== undefined) && {
        pricePence: { gte: q.minPrice, lte: q.maxPrice },
      }),
      ...((q.minAbv !== undefined || q.maxAbv !== undefined) && {
        abv: { gte: q.minAbv, lte: q.maxAbv },
      }),
      ...(q.search && {
        OR: [
          { name: { contains: q.search, mode: 'insensitive' } },
          { brand: { contains: q.search, mode: 'insensitive' } },
        ],
      }),
    };

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      q.sort === 'price_asc'
        ? { pricePence: 'asc' }
        : q.sort === 'price_desc'
          ? { pricePence: 'desc' }
          : q.sort === 'name'
            ? { name: 'asc' }
            : { createdAt: 'desc' };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { category: { select: { id: true, name: true, slug: true } } },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items: items.map(withFinalPrice),
      meta: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages: Math.ceil(total / q.limit),
      },
    };
  }

  /** Products at or below their own low-stock threshold, emptiest first (admin dashboard). */
  async findLowStock() {
    const rows = await this.prisma.$queryRaw<
      {
        id: string;
        name: string;
        brand: string | null;
        stock: number;
        lowStockThreshold: number;
      }[]
    >(Prisma.sql`
      SELECT id, name, brand, stock, "lowStockThreshold"
      FROM "Product"
      WHERE stock <= "lowStockThreshold"
      ORDER BY stock ASC, name ASC
    `);
    return rows.map((r) => ({ ...r, outOfStock: r.stock === 0 }));
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    return withFinalPrice(product);
  }

  async create(dto: CreateProductDto) {
    await this.assertCategory(dto.categoryId);
    const product = await this.prisma.product.create({ data: dto });
    return withFinalPrice(product);
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    if (dto.categoryId) await this.assertCategory(dto.categoryId);
    const product = await this.prisma.product.update({
      where: { id },
      data: dto,
    });
    return withFinalPrice(product);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.product.delete({ where: { id } });
  }

  private async assertCategory(categoryId: string) {
    const exists = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!exists) throw new BadRequestException('Category does not exist');
  }
}
