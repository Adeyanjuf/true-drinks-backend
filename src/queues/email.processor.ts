// queues/email.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { MailService } from '../mail/mail.service';

@Processor('email-queue')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly mailService: MailService) {
    super();
  }

  async process(job: Job) {
    this.logger.log(`Processing job: ${job.name}`);

    switch (job.name) {
      case 'send-otp':
      case 'resend-otp':
        await this.mailService.sendOtp(
          job.data.email,
          job.data.name,
          job.data.otp,
        );
        this.logger.log(`OTP email sent to ${job.data.email}`);
        break;

      case 'password-reset':
        await this.mailService.sendPasswordReset(
          job.data.email,
          job.data.name,
          job.data.token,
        );
        this.logger.log(`Password reset link email sent to ${job.data.email}`);
        break;

      default:
        this.logger.warn(`Unknown job: ${job.name}`);
    }
  }
}