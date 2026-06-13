import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
} from 'class-validator';

export class CreateUserDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ example: 'John Doe' })
    name!: string;

    @IsEmail()
    @IsNotEmpty()
    @ApiProperty({ example: 'john@example.com' })
    email!: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ example: 'secret123', minLength: 8 })
    password!: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ example: 'john123' })
    userName!: string;
}
