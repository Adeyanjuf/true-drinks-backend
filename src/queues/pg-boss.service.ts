import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import PgBoss from 'pg-boss';

export const EMAIL_OTP_QUEUE = 'email-otp';
export const EMAIL_PASSWORD_RESET_QUEUE = 'email-password-reset';
export const EMAIL_ORDER_RECEIPT_QUEUE = 'email-order-receipt';
export const EMAIL_ORDER_STATUS_QUEUE = 'email-order-status';
export const EMAIL_LOW_STOCK_QUEUE = 'email-low-stock';

// Job payloads carry plaintext OTPs / reset tokens, so completed jobs are purged quickly.
const SHORT_LIVED = {
  retryLimit: 3,
  retryDelay: 10,
  retryBackoff: true,
  expireInSeconds: 60,
  retentionSeconds: 15 * 60,
  deleteAfterSeconds: 15 * 60,
};

@Injectable()
export class PgBossService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PgBossService.name);
  readonly boss = new PgBoss({
    connectionString: process.env.DATABASE_URL,
    ssl: true,
    schema: 'pgboss',
  });

  private readyPromise?: Promise<void>;

  // Nest runs a module's onModuleInit hooks concurrently, so anything using the
  // queue must `await ready()` rather than assume start() has finished.
  ready(): Promise<void> {
    this.readyPromise ??= this.start();
    return this.readyPromise;
  }

  private async start() {
    this.boss.on('error', (err) =>
      this.logger.error(`pg-boss error: ${err.message}`),
    );
    await this.boss.start();
    await this.boss.createQueue(EMAIL_OTP_QUEUE, SHORT_LIVED);
    await this.boss.createQueue(EMAIL_PASSWORD_RESET_QUEUE, SHORT_LIVED);
    await this.boss.createQueue(EMAIL_ORDER_RECEIPT_QUEUE, SHORT_LIVED);
    await this.boss.createQueue(EMAIL_ORDER_STATUS_QUEUE, SHORT_LIVED);
    await this.boss.createQueue(EMAIL_LOW_STOCK_QUEUE, SHORT_LIVED);
    this.logger.log('pg-boss started');
  }

  async onModuleInit() {
    await this.ready();
  }

  async onModuleDestroy() {
    await this.boss.stop();
  }
}
