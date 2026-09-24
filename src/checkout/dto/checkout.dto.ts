import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { AddressDto } from '../../common/dto/address.dto';

const trimUpper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class QuoteDto {
  @ApiPropertyOptional({ example: 'SUMMER10' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(trimUpper)
  promoCode?: string;
}

export class CreatePaymentIntentDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name!: string;

  @ApiProperty({
    example: 'john@example.com',
    description: 'Where the receipt and tracking ID are sent',
  })
  @IsEmail()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @ApiProperty({ type: AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;

  @ApiPropertyOptional({ example: 'SUMMER10' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(trimUpper)
  promoCode?: string;

  @ApiPropertyOptional({
    example: '1990-04-23',
    description:
      'Date of birth (YYYY-MM-DD). Required when the cart contains age-restricted items; not stored.',
  })
  @IsOptional()
  @IsDateString(
    { strict: true },
    { message: 'Date of birth must be a date like 1990-04-23' },
  )
  dob?: string;
}
