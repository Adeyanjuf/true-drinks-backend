import { Controller, Get, Req } from '@nestjs/common';
import express from 'express';
import { AppService } from './app.service';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('system')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @SkipThrottle()
  @Get('health')
  getHello(): string {
    return this.appService.getHello();
  }

  @ApiExcludeEndpoint()
  @Get('debug-ip')
  checkIp(@Req() req: express.Request) {
    return { ip: req.ip, forwardedFor: req.headers['x-forwarded-for'] };
  }
}
