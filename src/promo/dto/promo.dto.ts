import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export enum PromoTypeDto {
  PERCENT = 'PERCENT',
  FIXED = 'FIXED',
}

export class CreatePromoDto {
  @ApiProperty({
    example: 'SUMMER10',
    description: 'Letters/numbers/-/_, stored uppercase',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z0-9_-]{3,30}$/)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  code!: string;

  @ApiProperty({ enum: PromoTypeDto })
  @IsEnum(PromoTypeDto)
  type!: PromoTypeDto;

  @ApiProperty({
    example: 10,
    description: 'Percent (1-100) for PERCENT, pence for FIXED',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ValidateIf((o: CreatePromoDto) => o.type === PromoTypeDto.PERCENT)
  @Max(100)
  value!: number;

  @ApiPropertyOptional({
    example: 2000,
    description: 'Minimum item subtotal in pence',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minSpendPence?: number;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;

  @ApiPropertyOptional({
    example: 100,
    description: 'Total redemptions allowed',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePromoDto extends PartialType(CreatePromoDto) {}
