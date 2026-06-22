import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({ example: 'JohnDoe@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  email!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'JohnDoe@example.com / johnDoe123' })
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  identifier!: string;
  
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'secret123', minLength: 8 })
  @Transform(({ value }) => value?.trim())
  password!: string;
}