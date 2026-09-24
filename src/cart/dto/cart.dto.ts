import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export const MAX_LINE_QUANTITY = 24;

export class AddCartItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: MAX_LINE_QUANTITY })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LINE_QUANTITY)
  quantity!: number;
}

export class UpdateCartItemDto {
  @ApiProperty({
    example: 3,
    minimum: 0,
    maximum: MAX_LINE_QUANTITY,
    description: 'Set to 0 to remove the item',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_LINE_QUANTITY)
  quantity!: number;
}
