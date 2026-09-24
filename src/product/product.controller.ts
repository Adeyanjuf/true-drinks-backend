import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProductService } from './product.service';
import {
  CreateProductDto,
  ProductQueryDto,
  UpdateProductDto,
} from './dto/product.dto';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiResponse } from '../common/response/api-response';
import { ApiAdminOnly, ApiEnvelope } from '../common/response/api-response.doc';

@ApiTags('products')
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @ApiEnvelope(
    'Paginated products; prices in pence, finalPricePence = price after discount',
    {
      items: [
        {
          id: 'cuid',
          name: 'Smirnoff Red Label 70cl',
          pricePence: 1899,
          discountPercent: 10,
          finalPricePence: 1709,
          weightGrams: 1100,
          abv: 37.5,
          isAgeRestricted: true,
          stock: 12,
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    },
  )
  @ApiOperation({
    summary: 'List products with filters and pagination (public)',
  })
  async findAll(@Query() query: ProductQueryDto) {
    return ApiResponse.success(await this.productService.findAll(query));
  }

  // Declared before ':id' so "low-stock" isn't treated as a product id.
  @Get('low-stock')
  @ApiBearerAuth('access-token')
  @ApiAdminOnly()
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Products at or below their low-stock threshold (admin). An email alert is also sent when an order pushes a product across its threshold.',
  })
  @ApiEnvelope('Low-stock products, emptiest first', [
    {
      id: 'cuid',
      name: 'Jameson 70cl',
      stock: 2,
      lowStockThreshold: 5,
      outOfStock: false,
    },
  ])
  async lowStock() {
    return ApiResponse.success(await this.productService.findLowStock());
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product details (public)' })
  async findOne(@Param('id') id: string) {
    return ApiResponse.success(await this.productService.findOne(id));
  }

  @Post()
  @ApiBearerAuth('access-token')
  @ApiAdminOnly()
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a product (admin)' })
  async create(@Body() dto: CreateProductDto) {
    return ApiResponse.success(
      await this.productService.create(dto),
      'Product created',
      201,
    );
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @ApiAdminOnly()
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a product (admin)' })
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return ApiResponse.success(
      await this.productService.update(id, dto),
      'Product updated',
    );
  }

  @Delete(':id')
  @ApiEnvelope('Deleted', null, 'Product deleted')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiAdminOnly()
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a product (admin)' })
  async remove(@Param('id') id: string) {
    await this.productService.remove(id);
    return ApiResponse.success(null, 'Product deleted');
  }
}
