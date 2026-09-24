import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// Standard UK postcode format (incl. GIR 0AA), spaces optional.
const UK_POSTCODE =
  /^(GIR ?0AA|[A-PR-UWYZ]([0-9]{1,2}|([A-HK-Y][0-9]([0-9ABEHMNPRV-Y])?)|[0-9][A-HJKPS-UW]) ?[0-9][ABD-HJLNP-UW-Z]{2})$/i;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** "sw1a1aa" -> "SW1A 1AA" */
export const normalisePostcode = (value: string) => {
  const compact = value.replace(/\s+/g, '').toUpperCase();
  return compact.length > 3
    ? `${compact.slice(0, -3)} ${compact.slice(-3)}`
    : compact;
};

export class AddressDto {
  @ApiProperty({ example: '10 Downing Street' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(trim)
  line1!: string;

  @ApiPropertyOptional({ example: 'Flat 2' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trim)
  line2?: string;

  @ApiProperty({ example: 'London' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  @Transform(trim)
  city!: string;

  @ApiProperty({
    example: 'SW1A 2AA',
    description: 'UK postcode (delivery is UK-only)',
  })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && UK_POSTCODE.test(value.trim())
      ? normalisePostcode(value)
      : value,
  )
  @Matches(UK_POSTCODE, { message: 'Please enter a valid UK postcode' })
  postcode!: string;

  @ApiProperty({
    example: '+44 7700 900123',
    description: 'Contact number for the delivery (required)',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[0-9 ()-]{7,20}$/, {
    message: 'Please enter a valid phone number',
  })
  @Transform(trim)
  phone!: string;
}
