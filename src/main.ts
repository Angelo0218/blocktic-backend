import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const isProd = config.get('NODE_ENV') === 'production';

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: isProd
      ? ['https://blocktic.app']
      : ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
  });

  // Swagger 僅在非 production 環境啟用
  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('BlockTic API')
      .setDescription(
        'AI-powered anti-scalper ticketing system with VRF lottery, face KYC, and blockchain audit',
      )
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api', app, document);
  }

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`BlockTic API running on http://localhost:${port}`);
  if (!isProd) {
    console.log(`Swagger docs at http://localhost:${port}/api`);
  }
}
bootstrap();
