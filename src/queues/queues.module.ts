// queues/queues.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EmailProcessor } from './email.processor';
import { EmailQueue } from './email.queue';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'email-queue',
    }),
    MailModule,
  ],
  providers: [EmailProcessor, EmailQueue],
  exports: [EmailQueue],
})
export class QueuesModule {}