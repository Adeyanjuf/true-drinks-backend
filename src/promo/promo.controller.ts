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
import { PromoService } from './promo.service';
import { CreatePromoDto, UpdatePromoDto } from './dto/promo.dto';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiResponse } from '../common/response/api-response';
import {
  ApiAdminOnly,
  ApiConflict,
  ApiEnvelope,
} from '../common/response/api-response.doc';

const promoExample = {
  id: 'cuid',
  code: 'SUMMER10',
  type: 'PERCENT',
  value: 10,
  minSpendPence: 2000,
  expiresAt: null,
  usageLimit: 100,
  usedCount: 3,
  isActive: true,
};

@ApiTags('promo-codes')
@ApiBearerAuth('access-token')
@ApiAdminOnly()
@UseGuards(JwtGuard, RolesGuard)
@Roles('ADMIN')
@Controller('promo-codes')
export class PromoController {
  constructor(private readonly promoService: PromoService) {}

  @Get()
  @ApiOperation({ summary: 'List promo codes (admin)' })
  @ApiEnvelope('Promo codes', [promoExample])
  async findAll() {
    return ApiResponse.success(await this.promoService.findAll());
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a promo code (admin)' })
  @ApiEnvelope('Promo code', promoExample)
  async findOne(@Param('id') id: string) {
    return ApiResponse.success(await this.promoService.findOne(id));
  }

  @Post()
  @ApiOperation({ summary: 'Create a promo code (admin)' })
  @ApiConflict('A promo code with this code already exists')
  async create(@Body() dto: CreatePromoDto) {
    return ApiResponse.success(
      await this.promoService.create(dto),
      'Promo code created',
      201,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a promo code (admin)' })
  @ApiConflict('A promo code with this code already exists')
  async update(@Param('id') id: string, @Body() dto: UpdatePromoDto) {
    return ApiResponse.success(
      await this.promoService.update(id, dto),
      'Promo code updated',
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a promo code (admin)' })
  @ApiEnvelope('Deleted', null, 'Promo code deleted')
  async remove(@Param('id') id: string) {
    await this.promoService.remove(id);
    return ApiResponse.success(null, 'Promo code deleted');
  }
}
