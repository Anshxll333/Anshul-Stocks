import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { AiModule } from './ai/ai.module';
import { UsersModule } from './users/users.module';
import { ConversationsModule } from './conversations/conversations.module';
import { UploadModule } from './upload/upload.module';
import { ProvidersModule } from './providers/providers.module';
import { CacheModule } from './cache/cache.module';
import { DebugModule } from './debug/debug.module';
import { MarketModule } from './market/market.module';
import { RequestTracingMiddleware } from './middleware/request-tracing.middleware';
import aiConfig from './config/ai.config';
import uploadConfig from './config/upload.config';
import providerConfig from './config/provider.config';
import appConfig from './config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [aiConfig, uploadConfig, providerConfig, appConfig],
    }),
    // Enables @Cron/@Interval decorators (used by IpoSchedulerService for the
    // hourly automatic IPO synchronization).
    ScheduleModule.forRoot(),
    DatabaseModule,
    UsersModule,
    AuthModule,
    AiModule,
    ConversationsModule,
    UploadModule,
    ProvidersModule,
    CacheModule,
    DebugModule,
    MarketModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestTracingMiddleware).forRoutes('*');
  }
}
