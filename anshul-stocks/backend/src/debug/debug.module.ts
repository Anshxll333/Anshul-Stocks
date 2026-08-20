import { Module } from '@nestjs/common';
import { DebugController } from './debug.controller';
import { AiModule } from '../ai/ai.module';
import { ProvidersModule } from '../providers/providers.module';
import { CacheModule } from '../cache/cache.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [AiModule, ProvidersModule, CacheModule, DatabaseModule],
  controllers: [DebugController],
})
export class DebugModule {}
