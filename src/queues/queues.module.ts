import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { EmailProcessor } from './email.processor';
import { EmailQueue } from './email.queue';
import { PgBossService } from './pg-boss.service';

@Module({
  imports: [MailModule],
  providers: [PgBossService, EmailProcessor, EmailQueue],
  exports: [EmailQueue],
})
export class QueuesModule {}
