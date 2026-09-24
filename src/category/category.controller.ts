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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CategoryService } from './category.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiResponse } from '../common/response/api-response';

@ApiTags('categories')
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @ApiOperation({ summary: 'List all categories (public)' })
  async findAll() {
    return ApiResponse.success(await this.categoryService.findAll());
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a category (public)' })
  async findOne(@Param('id') id: string) {
    return ApiResponse.success(await this.categoryService.findOne(id));
  }

  @Post()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a category (admin)' })
  async create(@Body() dto: CreateCategoryDto) {
    return ApiResponse.success(
      await this.categoryService.create(dto),
      'Category created',
      201,
    );
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a category (admin)' })
  async update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return ApiResponse.success(
      await this.categoryService.update(id, dto),
      'Category updated',
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Delete a category (admin); blocked if it has products',
  })
  async remove(@Param('id') id: string) {
    await this.categoryService.remove(id);
    return ApiResponse.success(null, 'Category deleted');
  }
}
