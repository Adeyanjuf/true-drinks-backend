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

@ApiTags('products')
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @ApiOperation({
    summary: 'List products with filters and pagination (public)',
  })
  async findAll(@Query() query: ProductQueryDto) {
    return ApiResponse.success(await this.productService.findAll(query));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product details (public)' })
  async findOne(@Param('id') id: string) {
    return ApiResponse.success(await this.productService.findOne(id));
  }

  @Post()
  @ApiBearerAuth('access-token')
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
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a product (admin)' })
  async remove(@Param('id') id: string) {
    await this.productService.remove(id);
    return ApiResponse.success(null, 'Product deleted');
  }
}
