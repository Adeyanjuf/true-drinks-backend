import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({ example: 'JohnDoe@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  email!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'JohnDoe@example.com or johnDoe1234' })
  @IsNotEmpty()
  identifier!: string;
  
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'secret123', minLength: 8 })
  password!: string;
}