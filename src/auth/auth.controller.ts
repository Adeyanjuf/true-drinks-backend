import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  async requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.loginUser(dto);
  }

  @Post('request-otp/returning')
  @HttpCode(HttpStatus.OK)
  async requestOtpReturning(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto, true);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  async resendOtp(@Body() dto: RequestOtpDto & { isReturning?: boolean }) {
    return this.authService.requestOtp(dto, dto.isReturning ?? false);
  }
}