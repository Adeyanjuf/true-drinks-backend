import { Injectable } from '@nestjs/common';
import {
  EMAIL_OTP_QUEUE,
  EMAIL_PASSWORD_RESET_QUEUE,
  PgBossService,
} from './pg-boss.service';

export interface OtpEmailJob {
  email: string;
  name: string;
  otp: string;
}

export interface PasswordResetEmailJob {
  email: string;
  name: string;
  token: string;
}

@Injectable()
export class EmailQueue {
  constructor(private readonly pgBoss: PgBossService) {}

  async sendOtp(email: string, name: string, otp: string) {
    await this.pgBoss.ready();
    await this.pgBoss.boss.send(EMAIL_OTP_QUEUE, { email, name, otp });
  }

  async resendOtp(email: string, name: string, otp: string) {
    await this.sendOtp(email, name, otp);
  }

  async sendPasswordResetLink(email: string, name: string, token: string) {
    await this.pgBoss.ready();
    await this.pgBoss.boss.send(EMAIL_PASSWORD_RESET_QUEUE, {
      email,
      name,
      token,
    });
  }
}
