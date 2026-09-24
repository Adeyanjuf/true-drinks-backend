import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
  Get,
  Req,
  Res,
  Query,
} from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiExcludeEndpoint,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import * as client from '@prisma/client';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { LoginDto, RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto, VerifyOtpResponseDto } from './dto/verify-otp.dto';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { UserService } from '../user/user.service';
import { RequestResetDto, ResetPasswordDto } from './dto/request-reset.dto';
import { GetUser } from './decorators/get-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtGuard } from './guards/jwt.guard';
import { ApiResponse } from '../common/response/api-response';
import { ApiUnauthorized } from '../common/response/api-response.doc';
import { CheckUsernameDto } from './dto/check-username.dto';
import { CompleteGoogleProfileDto } from './dto/complete-google-profile.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Create / Register a user' })
  async create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Post('login')
  @ApiOperation({
    summary:
      'Step 1 of login: check email/username + password, then email a 6-digit OTP',
  })
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.loginUser(dto);
  }

  @Post('request-otp')
  @ApiOperation({ summary: 'Send an OTP to a registered email (60s cooldown)' })
  @HttpCode(HttpStatus.OK)
  async requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto);
  }

  @Post('request-otp/returning')
  @ApiOperation({
    summary: 'Send an OTP to a returning user (404 if the email is unknown)',
  })
  @HttpCode(HttpStatus.OK)
  async requestOtpReturning(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto, true);
  }

  @Post('verify-otp')
  @ApiOkResponse({
    type: VerifyOtpResponseDto,
    description: 'Tokens and user (role: ADMIN | CUSTOMER)',
  })
  @ApiOperation({
    summary:
      'Step 2 of login/registration: verify OTP and receive access + refresh tokens',
  })
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Post('resend-otp')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email'],
      properties: {
        email: { type: 'string', example: 'john@example.com' },
        isReturning: { type: 'boolean', default: false },
      },
    },
  })
  @ApiOperation({ summary: 'Resend an OTP' })
  @HttpCode(HttpStatus.OK)
  async resendOtp(@Body() dto: RequestOtpDto & { isReturning?: boolean }) {
    return this.authService.requestOtp(dto, dto.isReturning ?? false);
  }

  @Post('forgot-password')
  @ApiOperation({
    summary:
      'Email a password reset link (always returns a generic response; 3 requests / 15 min)',
  })
  @Throttle({ default: { limit: 3, ttl: 15 * 60 * 1000 } }) // 3 requests per 15 min
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: RequestResetDto) {
    return await this.authService.requestPasswordReset(dto.email);
  }

  @Post('reset-password')
  @ApiOperation({
    summary:
      'Reset password with the emailed token; revokes all refresh tokens',
  })
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return await this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Post('change-password')
  @ApiOperation({
    summary: 'Change password while logged in; revokes all refresh tokens',
  })
  @ApiBearerAuth('access-token')
  @ApiUnauthorized()
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(@GetUser() user: any, @Body() dto: ChangePasswordDto) {
    return await this.authService.changePassword(user.id, dto);
  }

  @ApiExcludeEndpoint()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    // AuthGuard redirects to Google's consent screen
  }

  @ApiExcludeEndpoint()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req, @Res() res: Response) {
    const { email, name } = req.user;
    const redirectUrl = await this.authService.googleLogin({ email, name });
    return res.redirect(redirectUrl);
  }

  @Get('check-username')
  @ApiOperation({ summary: 'Check whether a username is free' })
  async checkUsername(@Query() dto: CheckUsernameDto) {
    return ApiResponse.success(
      await this.authService.checkUsernameAvailability(dto.username),
    );
  }

  @Post('complete-profile')
  @ApiCreatedResponse({ type: VerifyOtpResponseDto })
  @ApiOperation({
    summary:
      'Google sign-up: choose username and password to create the account',
  })
  async completeGoogleProfile(@Body() dto: CompleteGoogleProfileDto) {
    return await this.authService.completeGoogleProfile(dto);
  }

  @Post('refresh')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['refreshToken'],
      properties: { refreshToken: { type: 'string' } },
    },
  })
  @ApiOperation({
    summary:
      'Exchange a refresh token for a new access + refresh token pair (old one is rotated out)',
  })
  async refresh(@Body('refreshToken') refreshToken: string) {
    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }
    const tokens = await this.authService.refreshAccessToken(refreshToken);
    return ApiResponse.success({ ...tokens });
  }

  @ApiBearerAuth('access-token')
  @ApiUnauthorized()
  @UseGuards(JwtGuard)
  @Post('logout')
  @ApiBody({
    schema: {
      type: 'object',
      required: [],
      properties: { refreshToken: { type: 'string' } },
    },
  })
  @ApiOperation({
    summary:
      'Revoke the given refresh token (access token stays valid until it expires)',
  })
  async logout(@Body('refreshToken') refreshToken: string) {
    if (refreshToken) {
      await this.authService.revokeRefreshToken(refreshToken);
    }
    return ApiResponse.success({ message: 'Logged out successfully.' });
  }

  @ApiBearerAuth('access-token')
  @ApiUnauthorized()
  @UseGuards(JwtGuard)
  @Post('logout-all')
  @ApiOperation({ summary: 'Revoke all refresh tokens for the current user' })
  async logoutAll(@GetUser() user: client.User) {
    await this.authService.revokeAllSessions(user.id);
    return ApiResponse.success({ message: 'Logged out from all devices.' });
  }
}
