import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { UserService } from '../user/user.service';
import { ApiOperation } from '@nestjs/swagger';
import { RequestResetDto, ResetPasswordDto } from './dto/request-reset.dto';
import { GetUser } from './decorators/get-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtGuard } from './guards/jwt.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Create / Register a user' })
  async create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.loginUser(dto);
  }

  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  async requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto);
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

  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 15 * 60 * 1000 } }) // 3 requests per 15 min
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: RequestResetDto) {
    return await this.authService.requestPasswordReset(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return await this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Post('change-password')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(@GetUser() user: any, @Body() dto: ChangePasswordDto) {
    return await this.authService.changePassword(user.id, dto);
  }
}