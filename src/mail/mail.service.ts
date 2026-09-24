import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { otpEmailTemplate } from './templates/otp.template';
import { PasswordResetTemplate } from './templates/password-reset.template';
import { OrderStatus } from '@prisma/client';
import {
  LowStockProduct,
  lowStockTemplate,
} from './templates/low-stock.template';
import {
  OrderEmailData,
  orderReceiptTemplate,
  orderStatusTemplate,
} from './templates/order.template';

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
    } catch {
      throw new InternalServerErrorException(
        'Failed to send verification email. Please try again.',
      );
    }
  }

  async sendPasswordReset(
    email: string,
    name: string,
    token: string,
  ): Promise<void> {
    try {
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
      await this.resend.emails.send({
        from: this.from,
        to: email,
        subject: 'Your Password Reset Link',
        html: PasswordResetTemplate(resetUrl, name),
      });
    } catch {
      throw new InternalServerErrorException(
        'Failed to send password reset email. Please try again.',
      );
    }
  }

  async sendOrderReceipt(order: OrderEmailData): Promise<void> {
    await this.send(
      order.email,
      `Your order ${order.trackingId}`,
      orderReceiptTemplate(order),
    );
  }

  async sendOrderStatus(
    order: Pick<OrderEmailData, 'email' | 'name' | 'trackingId'>,
    status: OrderStatus,
  ): Promise<void> {
    const subject =
      status === 'DELIVERED'
        ? `Your order ${order.trackingId} has been delivered`
        : `Your order ${order.trackingId} is out for delivery`;
    await this.send(order.email, subject, orderStatusTemplate(order, status));
  }

  async sendLowStock(to: string[], products: LowStockProduct[]): Promise<void> {
    await this.send(to, 'Low stock warning', lowStockTemplate(products));
  }

  private async send(
    to: string | string[],
    subject: string,
    html: string,
  ): Promise<void> {
    try {
      await this.resend.emails.send({ from: this.from, to, subject, html });
    } catch {
      throw new InternalServerErrorException(
        'Failed to send email. Please try again.',
      );
    }
  }
}
