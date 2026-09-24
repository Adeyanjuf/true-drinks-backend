import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { OtpEmailJob, PasswordResetEmailJob } from './email.queue';
import {
  EMAIL_OTP_QUEUE,
  EMAIL_PASSWORD_RESET_QUEUE,
  PgBossService,
} from './pg-boss.service';

@Injectable()
export class EmailProcessor implements OnModuleInit {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly pgBoss: PgBossService,
    private readonly mailService: MailService,
  ) {}

  async onModuleInit() {
    await this.pgBoss.ready();
    // Handlers throw on failure so pg-boss retries with backoff.
    await this.pgBoss.boss.work<OtpEmailJob>(EMAIL_OTP_QUEUE, async (jobs) => {
      for (const job of jobs) {
        await this.mailService.sendOtp(
          job.data.email,
          job.data.name,
          job.data.otp,
        );
        this.logger.log(`OTP email sent to ${job.data.email}`);
      }
    });

    await this.pgBoss.boss.work<PasswordResetEmailJob>(
      EMAIL_PASSWORD_RESET_QUEUE,
      async (jobs) => {
        for (const job of jobs) {
          await this.mailService.sendPasswordReset(
            job.data.email,
            job.data.name,
            job.data.token,
          );
          this.logger.log(`Password reset email sent to ${job.data.email}`);
        }
      },
    );
  }
}
