import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ example: 'John Doe' })
    @Transform(({ value }) => value?.trim())
    name!: string;

    @IsEmail()
    @IsNotEmpty()
    @ApiProperty({ example: 'john@example.com' })
    @Transform(({ value }) => value?.trim())
    email!: string;

    @IsString()
    @MinLength(8)
    @ApiProperty({ example: 'secret123', minLength: 8 })
    @Transform(({ value }) => value?.trim())
    password!: string;

    @IsString()
    @Matches(/^[a-zA-Z0-9_]{3,20}$/, {
      message: 'Username must be 3-20 characters, letters, numbers and underscores only',
    })
    @ApiProperty({ example: 'john123' })
    @Transform(({ value }) => value?.trim())
    username!: string;
}
