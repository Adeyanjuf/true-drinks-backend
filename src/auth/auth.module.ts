import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtGuard } from './guards/jwt.guard';
import { RolesGuard } from './guards/roles.guard';
import { GoogleStrategy } from './strategies/google.strategy';
import { PrismaModule } from '../prisma/prisma.module';
import { QueuesModule } from '../queues/queues.module';
import { UserService } from '../user/user.service';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET')!,
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN') as any },
      }),
    }),
    QueuesModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds, in ms
        limit: 10, // 10 requests per ttl window, global default
      },
    ]),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    JwtGuard,
    RolesGuard,
    UserService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, // applies globally to all routes
    },
  ],
  controllers: [AuthController],
  exports: [AuthService, JwtGuard, RolesGuard, JwtStrategy],
})
export class AuthModule {}
