import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true, // Stripe webhook signature verification needs the raw body
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.enableCors({
    origin: ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-cart-token'],
  });

  app.set('trust proxy', 1);

  const config = new DocumentBuilder()
    .setTitle('Drink Store API')
    .setDescription(
      'Backend API for the drinks store.\n\n' +
        '**Auth:** register or log in, then verify the emailed OTP at `POST /auth/verify-otp` to get an access token; click Authorize and paste it. ' +
        'Admin-only routes need a token from a user whose role is `ADMIN`.\n\n' +
        '**Conventions:** all prices are in pence (integer); every response is wrapped as `{ statusCode, message, data }`.',
    )
    .addTag('auth', 'Registration, OTP login, tokens, password flows')
    .addTag('categories', 'Drink categories (writes are admin-only)')
    .addTag(
      'cart',
      'Server-side cart for guests (x-cart-token) and logged-in users',
    )
    .addTag('checkout', 'Quote, payment and order creation')
    .addTag('orders', 'Order history and admin order management')
    .addTag('tracking', 'Public order tracking')
    .addTag('promo-codes', 'Promotional codes (admin-only)')
    .addTag('products', 'Drinks catalogue with filters (writes are admin-only)')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        in: 'header',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/documentation', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');

  console.log(`Application running on: http://localhost:${port}`);
}
bootstrap();
