import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
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
    @IsNotEmpty()
    @ApiProperty({ example: 'secret123', minLength: 8 })
    @Transform(({ value }) => value?.trim())
    password!: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ example: 'john123' })
    @Transform(({ value }) => value?.trim())
    username!: string;
}
