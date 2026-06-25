import { Controller, Get, Req } from '@nestjs/common';
import express from 'express';
import { AppService } from './app.service';
import { SkipThrottle } from '@nestjs/throttler';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @SkipThrottle()
  @Get('health')
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('debug-ip')
  checkIp(@Req() req: express.Request) {
    return { ip: req.ip, forwardedFor: req.headers['x-forwarded-for'] };
  }
}
