// queues/email.queue.ts
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class EmailQueue {
  constructor(
    @InjectQueue('email-queue') private readonly emailQueue: Queue,
  ) {}

  async sendOtp(email: string, name: string, otp: string) {
    await this.emailQueue.add('send-otp', { email, name, otp });
  }

  async resendOtp(email: string, name: string, otp: string) {
    await this.emailQueue.add('resend-otp', { email, name, otp });
  }
  
  async sendPasswordResetLink(email: string, name: string, token: string) {
    await this.emailQueue.add('password-reset', { email, name, token });
  }
}