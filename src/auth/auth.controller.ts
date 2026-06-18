import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  Param,
  Req,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { UserService } from '../user/user.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { ApiOperation } from '@nestjs/swagger';
import { JwtGuard } from './guards/jwt.guard';
import { GetUser } from './decorators/get-user.decorator';
import { ApiResponse } from '../common/response/api-response';
import { AuthGuard } from '@nestjs/passport';
import express from 'express';
import { CompleteGoogleProfileDto } from './dto/complete-google-profile.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create / Register a user' })
  async register(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // redirects to Google consent screen — guard handles it
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req, @Res() res: express.Response) {
    const result = await this.authService.googleLogin(req.user);
    res.redirect(result);
  }

  @Post('complete-profile')
  async completeGoogleProfile(@Body() dto: CompleteGoogleProfileDto) {
    return this.authService.completeGoogleProfile(dto);
  }
  
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user' })
  async login(@Body() dto: LoginDto) {
    return this.authService.loginUser(dto);
  }

  @Post('logout')
  @UseGuards(JwtGuard)
  async logout(@GetUser('id') userId: string) {
    return this.authService.logout(userId);
  }

  @Get('check-username/:username')
  async checkUsername(@Param('username') username: string) {
    const result = await this.authService.checkUsernameAvailability(username);
    return ApiResponse.success(result, 'Availability checked');
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
}