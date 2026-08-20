import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { GlobalExceptionFilter } from './middleware/http-exception.filter';
import { AppLogger } from './utils/logger';

async function bootstrap() {
  const logger = new AppLogger();
  logger.setContext('Bootstrap');

  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend requests
  app.enableCors({
    origin: '*', // For Sprint 1 development; refine in production
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Set global API route prefix (excluding root index and /health)
  app.setGlobalPrefix('api', { exclude: ['health', ''] });

  // Global exception filter for consistent JSON error formatting
  app.useGlobalFilters(new GlobalExceptionFilter());

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000;

  await app.listen(port);
  logger.log(`Anshul Stocks Backend started successfully on port ${port}`);
}
bootstrap();
