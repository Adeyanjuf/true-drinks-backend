import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async create(dto: CreateCategoryDto) {
    const slug = slugify(dto.name);
    await this.assertUnique(dto.name, slug);
    return this.prisma.category.create({ data: { name: dto.name, slug } });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findOne(id);
    if (!dto.name) return this.findOne(id);

    const slug = slugify(dto.name);
    await this.assertUnique(dto.name, slug, id);
    return this.prisma.category.update({
      where: { id },
      data: { name: dto.name, slug },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    const productCount = await this.prisma.product.count({
      where: { categoryId: id },
    });
    if (productCount > 0) {
      throw new ConflictException(
        `Cannot delete a category with ${productCount} product(s). Move or delete them first.`,
      );
    }
    await this.prisma.category.delete({ where: { id } });
  }

  private async assertUnique(name: string, slug: string, excludeId?: string) {
    const clash = await this.prisma.category.findFirst({
      where: {
        OR: [{ name }, { slug }],
        ...(excludeId && { NOT: { id: excludeId } }),
      },
    });
    if (clash)
      throw new ConflictException('A category with this name already exists');
  }
}
