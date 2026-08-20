import { Module } from '@nestjs/common';
import { MarketController } from './market.controller';
import { ProvidersModule } from '../providers/providers.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [ProvidersModule, UploadModule],
  controllers: [MarketController],
  providers: [],
})
export class MarketModule {}
