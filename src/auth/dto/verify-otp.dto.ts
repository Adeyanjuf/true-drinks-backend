import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  email!: string;
    
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'OTP must be 6 digits' })
  otp!: string;
}

export class VerifyOtpResponseDto {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string | null
  };

  constructor(token: string, userId: string, userEmail: string, userName: string, userRole: string | null) {
    this.token = token;
    this.user = { id: userId, email: userEmail, name: userName, role: userRole };
  }
}