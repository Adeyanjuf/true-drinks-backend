import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { AddressDto } from '../common/dto/address.dto';
import { ApiResponse } from '../common/response/api-response';
import {
  ApiEnvelope,
  ApiUnauthorized,
} from '../common/response/api-response.doc';

const addressExample = {
  line1: '10 Downing Street',
  line2: null,
  city: 'London',
  postcode: 'SW1A 2AA',
  phone: null,
};

// The single saved delivery address for a registered customer; used to prefill checkout.
@ApiTags('user')
@ApiBearerAuth('access-token')
@ApiUnauthorized()
@UseGuards(JwtGuard)
@Controller('user/me/address')
export class AddressController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Get my saved delivery address (null if none)' })
  @ApiEnvelope('Saved address or null', addressExample)
  async get(@GetUser() user: { id: string }) {
    const address = await this.prisma.userAddress.findUnique({
      where: { userId: user.id },
      select: {
        line1: true,
        line2: true,
        city: true,
        postcode: true,
        phone: true,
      },
    });
    return ApiResponse.success(address);
  }

  @Put()
  @ApiOperation({ summary: 'Create or replace my saved delivery address' })
  @ApiEnvelope('Saved address', addressExample, 'Address saved')
  async put(@GetUser() user: { id: string }, @Body() dto: AddressDto) {
    const data = {
      line1: dto.line1,
      line2: dto.line2 ?? null,
      city: dto.city,
      postcode: dto.postcode,
      phone: dto.phone ?? null,
    };
    const address = await this.prisma.userAddress.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data },
      update: data,
      select: {
        line1: true,
        line2: true,
        city: true,
        postcode: true,
        phone: true,
      },
    });
    return ApiResponse.success(address, 'Address saved');
  }
}
