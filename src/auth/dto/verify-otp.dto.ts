import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class VerifyOtpDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }) => value?.trim())
  @IsNotEmpty()
  @ApiProperty({ example: 'JohnDoe@example.com' })
  email!: string;
    
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  @Length(6, 6, { message: 'OTP must be 6 digits' })
  @ApiProperty({ example: '123456', minLength: 6, maxLength: 6 })
  otp!: string;
}

export class VerifyOtpResponseDto {
  token: { accessToken: string, refreshToken: string};
  user: {
    id: string;
    email: string;
    name: string;
    role: string | null
  };

  constructor(token: { accessToken: string, refreshToken: string}, userId: string, userEmail: string, userName: string, userRole: string | null) {
    this.token = token;
    this.user = { id: userId, email: userEmail, name: userName, role: userRole };
  }
}