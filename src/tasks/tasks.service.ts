import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TasksService {
    private readonly logger = new Logger(TasksService.name);

    constructor(private prisma: PrismaService) {}

    @Cron(CronExpression.EVERY_5_MINUTES)
    async keepDbAwake() {
        try {
            await this.prisma.$queryRaw`SELECT 1`;
            this.logger.log('DB pinged successfully');
        } catch (error) {
            this.logger.warn('DB ping failed, retrying in 5 seconds...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            try {
                await this.prisma.$queryRaw`SELECT 1`;
                this.logger.log('DB pinged successfully on retry');
            } catch (retryError) {
                this.logger.error('DB ping failed after retry', retryError);
            }
        }
    }
}