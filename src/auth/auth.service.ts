import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import validatorIsEmail from 'validator/lib/isEmail';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto, VerifyOtpResponseDto } from './dto/verify-otp.dto';
import { EmailQueue } from '../queues/email.queue';
import { ApiResponse } from '../common/response/api-response';
import { CompleteGoogleProfileDto } from './dto/complete-google-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private readonly emailQueue: EmailQueue,
  ) {}

  private async generateJwt(userId: string) {
    const accessToken = this.jwt.sign({ sub: userId });

    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const hashedRefreshToken = this.hashToken(rawRefreshToken);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: hashedRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  async revokeAllSessions(userId: string) {
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  async refreshAccessToken(rawRefreshToken: string) {
    const hashedToken = this.hashToken(rawRefreshToken);

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: hashedToken },
    });

    if (
      !storedToken ||
      storedToken.revokedAt ||
      storedToken.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // rotation: kill the old one, issue a fresh pair
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    return this.generateJwt(storedToken.userId);
  }

  async revokeRefreshToken(rawRefreshToken: string) {
    const hashedToken = this.hashToken(rawRefreshToken);
    await this.prisma.refreshToken.deleteMany({
      where: { token: hashedToken },
    });
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async loginUser(dto: LoginDto) {
    const isEmailIdentifier = validatorIsEmail(dto.identifier);

    const user = await this.prisma.user.findUnique({
      where: isEmailIdentifier
        ? { email: dto.identifier }
        : { username: dto.identifier },
    });

    const dummyHash =
      '$2b$10$invalidhashfortimingprotection000000000000000000000';
    const isMatch = await bcrypt.compare(
      dto.password,
      user?.password ?? dummyHash,
    );

    if (!user || !isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const message = await this.requestOtp({ email: user.email });

    return ApiResponse.success(message);
  }

  async requestOtp(
    dto: RequestOtpDto,
    isReturningUser = false,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (isReturningUser && !user) {
      throw new NotFoundException('No account found with this email address');
    }

    if (!isReturningUser && !user) {
      throw new NotFoundException(
        'user record not found. Please complete the booking form first.',
      );
    }

    if (user?.otp_expiresAt) {
      const now = new Date();
      const expiresAt = new Date(user.otp_expiresAt);
      const cooldownThreshold = new Date(expiresAt.getTime() - 9 * 60 * 1000);

      if (now < cooldownThreshold) {
        throw new BadRequestException(
          'Please wait 60 seconds before requesting a new code',
        );
      }
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const otp_hashed = await bcrypt.hash(otp, 10);
    const otp_expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.user.update({
      where: { email: dto.email },
      data: { otp_hashed, otp_expiresAt },
    });

    user && (await this.emailQueue.sendOtp(user.email, user.name, otp));

    return { message: 'Verification code sent to your email' };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<VerifyOtpResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new NotFoundException('Account not found');
    }

    if (!user.otp_hashed || !user.otp_expiresAt) {
      throw new BadRequestException(
        'No verification code found. Please request a new one.',
      );
    }

    const now = new Date();
    if (now > new Date(user.otp_expiresAt)) {
      throw new BadRequestException(
        'Verification code has expired. Please request a new one.',
      );
    }

    const isValid = await bcrypt.compare(dto.otp, user.otp_hashed);

    if (!isValid) {
      throw new UnauthorizedException('Invalid verification code');
    }

    const token = await this.generateJwt(user.id);

    await this.prisma.user.update({
      where: { email: dto.email },
      data: {
        otp_hashed: null,
        otp_expiresAt: null,
        isVerified: true,
      },
    });

    return new VerifyOtpResponseDto(
      token,
      user.id,
      user.email,
      user.name,
      user.role,
    );
  }

  async checkUsernameAvailability(username: string) {
    const existing = await this.prisma.user.findUnique({
      where: { username: username },
    });

    return {
      available: !existing,
      username,
    };
  }

  async googleLogin(googleProfile: { email: string; name: string }) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: googleProfile.email },
    });

    if (existingUser) {
      const token = await this.generateJwt(existingUser.id);

      return `${process.env.FRONTEND_URL}/auth/callback?token=${token.accessToken}`;
    }

    const encoded = encodeURIComponent(
      JSON.stringify({ email: googleProfile.email, name: googleProfile.name }),
    );
    return `${process.env.FRONTEND_URL}/auth/complete-profile?data=${encoded}`;
  }

  async completeGoogleProfile(dto: CompleteGoogleProfileDto) {
    // check email wasn't already registered while they were on the form
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingEmail) {
      throw new ConflictException('An account with this email already exists');
    }

    // check username availability
    const existingUsername = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (existingUsername) {
      throw new ConflictException('Username already taken');
    }

    const password_hashed = await bcrypt.hash(dto.password, 10);

    // create account — no OTP needed, Google verified the email
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        username: dto.username,
        password: password_hashed,
        isVerified: true,
      },
    });

    const token = await this.generateJwt(user.id);

    return new VerifyOtpResponseDto(
      token,
      user.id,
      user.email,
      user.name,
      user.role,
    );
  }

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const genericResponse = {
      message:
        'If an account exists with that email, a reset link has been sent.',
    };

    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      return ApiResponse.success(genericResponse); // no enumeration leak
    }

    // rate limit: block if a token was issued in the last 60s
    const recentToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        createdAt: { gte: new Date(Date.now() - 60 * 1000) },
      },
    });
    if (recentToken) {
      return ApiResponse.success(genericResponse); // silently no-op, still generic
    }

    // invalidate previous unused tokens
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = this.hashToken(rawToken);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: hashedToken,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    await this.emailQueue.sendPasswordResetLink(
      user.email,
      user.name,
      rawToken,
    );

    return ApiResponse.success(genericResponse);
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const hashedToken = this.hashToken(token);

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token: hashedToken },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.deleteMany({
        where: { userId: resetToken.userId },
      }),
    ]);

    return ApiResponse.success({
      message: 'Password has been reset successfully.',
    });
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isMatch = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isMatch) {
      throw new BadRequestException('Current password is incorrect');
    }

    // optional but good practice: prevent setting the same password again
    const isSamePassword = await bcrypt.compare(dto.newPassword, user.password);
    if (isSamePassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      }),
      this.prisma.refreshToken.deleteMany({
        where: { userId },
      }),
    ]);

    return ApiResponse.success({ message: 'Password changed successfully.' });
  }
}
