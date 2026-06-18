import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto, VerifyOtpResponseDto } from './dto/verify-otp.dto';
import { EmailQueue } from '../queues/email.queue';
import { ApiResponse } from '../common/response/api-response';
import { CompleteGoogleProfileDto } from './dto/complete-google-profile.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private readonly emailQueue: EmailQueue,
  ) {}

  private async generateJwt(userId: string, email: string): Promise<string> {
    const payload = {
      sub: userId,
      email,
    };

    return this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: '7d',
    });
  }

  async loginUser(dto: LoginDto) {
    const isEmail = dto.identifier.includes('@');

    const user = await this.prisma.user.findUnique({
      where: isEmail
        ? { email: dto.identifier }
        : { userName: dto.identifier },
    });

    const dummyHash = '$2b$10$invalidhashfortimingprotection000000000000000000000';
    const isMatch = await bcrypt.compare(dto.password, user?.password ?? dummyHash);

    if (!user || !isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const message = await this.requestOtp({ email: user.email });

    return ApiResponse.success(message)
  }
  
  async requestOtp(dto: RequestOtpDto, isReturningUser = false): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (isReturningUser && !user) {
      throw new NotFoundException(
        'No account found with this email address'
      );
    }

    if (!isReturningUser && !user) {
      throw new NotFoundException(
        'user record not found. Please complete the booking form first.'
      );
    }

    if (user?.otp_expiresAt) {
      const now = new Date();
      const expiresAt = new Date(user.otp_expiresAt);
      const cooldownThreshold = new Date(expiresAt.getTime() - 9 * 60 * 1000);

      if (now < cooldownThreshold) {
        throw new BadRequestException(
          'Please wait 60 seconds before requesting a new code'
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

    user && await this.emailQueue.sendOtp(user.email, user.name, otp);

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
        'No verification code found. Please request a new one.'
      );
    }

    const now = new Date();
    if (now > new Date(user.otp_expiresAt)) {
      throw new BadRequestException(
        'Verification code has expired. Please request a new one.'
      );
    }

    const isValid = await bcrypt.compare(dto.otp, user.otp_hashed);

    if (!isValid) {
      throw new UnauthorizedException('Invalid verification code');
    }

    const token = await this.generateJwt(user.id, user.email);

    await this.prisma.user.update({
      where: { email: dto.email },
      data: {
        otp_hashed: null,
        otp_expiresAt: null,
        isVerified: true,
        jwt_token: token
      },
    });

    return new VerifyOtpResponseDto(token, user.id, user.email, user.name, "user");  // Assuming role is always "user" for now, adjust as needed when roles are implemented
  }

  async logout(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new NotFoundException('Account not found');

    await this.prisma.user.update({
      where: { id: userId },
      data: { jwt_token: null },
    });

    return { message: 'Logged out successfully' };
  }

  async checkUsernameAvailability(username: string) {
    const existing = await this.prisma.user.findUnique({
      where: { userName: username },
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
      const token = await this.generateJwt(existingUser.id, existingUser.email);

      await this.prisma.user.update({
        where: { id: existingUser.id },
        data: { jwt_token: token },
      });

      return (`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
    }

    const encoded = encodeURIComponent(JSON.stringify({ email: googleProfile.email, name: googleProfile.name }));
    return (`${process.env.FRONTEND_URL}/auth/complete-profile?data=${encoded}`);
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
      where: { userName: dto.username },
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
        userName: dto.username,
        password: password_hashed,
        isVerified: true,
      },
    });

    const token = await this.generateJwt(user.id, user.email);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { jwt_token: token },
    });

    return new VerifyOtpResponseDto(token, user.id, user.email, user.name, 'user');
  }
}