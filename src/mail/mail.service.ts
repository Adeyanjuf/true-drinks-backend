import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { otpEmailTemplate } from './templates/otp.template';
import { PasswordResetTemplate } from './templates/password-reset.template';

@Injectable()
export class MailService {
  private resend: Resend;
  private from: string;

  constructor(private config: ConfigService) {
    this.resend = new Resend(this.config.get<string>('RESEND_API_KEY'));
    this.from = this.config.get<string>('MAIL_FROM')!;
  }

  async sendOtp(email: string, name: string, otp: string): Promise<void> {
    try {
      await this.resend.emails.send({
        from: this.from,
        to: email,
        subject: 'Your verification code',
        html: otpEmailTemplate(otp, name),
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to send verification email. Please try again.'
      );
    }
  }
  
  async sendPasswordReset(email: string, name: string, token: string): Promise<void> {
    try {
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
      await this.resend.emails.send({
        from: this.from,
        to: email,
        subject: 'Your Password Reset Link',
        html: PasswordResetTemplate(resetUrl, name),
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to send password reset email. Please try again.'
      );
    }
  }
}