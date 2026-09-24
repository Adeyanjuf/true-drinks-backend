import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { OtpEmailJob, PasswordResetEmailJob } from './email.queue';
import {
  EMAIL_LOW_STOCK_QUEUE,
  EMAIL_ORDER_RECEIPT_QUEUE,
  EMAIL_ORDER_STATUS_QUEUE,
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
    private readonly prisma: PrismaService,
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

    await this.pgBoss.boss.work<{ orderId: string }>(
      EMAIL_ORDER_RECEIPT_QUEUE,
      async (jobs) => {
        for (const job of jobs) {
          const order = await this.loadOrder(job.data.orderId);
          if (!order) continue;
          await this.mailService.sendOrderReceipt(order);
          this.logger.log(`Order receipt sent for ${order.trackingId}`);
        }
      },
    );

    await this.pgBoss.boss.work<{ orderId: string; status: OrderStatus }>(
      EMAIL_ORDER_STATUS_QUEUE,
      async (jobs) => {
        for (const job of jobs) {
          const order = await this.loadOrder(job.data.orderId);
          if (!order) continue;
          await this.mailService.sendOrderStatus(order, job.data.status);
          this.logger.log(
            `Order ${job.data.status} email sent for ${order.trackingId}`,
          );
        }
      },
    );

    await this.pgBoss.boss.work<{ productIds: string[] }>(
      EMAIL_LOW_STOCK_QUEUE,
      async (jobs) => {
        for (const job of jobs) {
          const [products, admins] = await Promise.all([
            this.prisma.product.findMany({
              where: { id: { in: job.data.productIds } },
              select: { name: true, stock: true, lowStockThreshold: true },
            }),
            this.prisma.user.findMany({
              where: { role: 'ADMIN', isVerified: true },
              select: { email: true },
            }),
          ]);
          if (products.length === 0 || admins.length === 0) continue;
          await this.mailService.sendLowStock(
            admins.map((a) => a.email),
            products,
          );
          this.logger.log(
            `Low-stock alert sent for ${products.length} product(s)`,
          );
        }
      },
    );
  }

  private async loadOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) this.logger.warn(`Order ${orderId} not found; skipping email`);
    return order;
  }
}
