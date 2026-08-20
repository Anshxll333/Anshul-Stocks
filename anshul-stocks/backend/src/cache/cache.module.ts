import { Module, Global } from '@nestjs/common';
import { MemoryCacheService } from './memory-cache.service';
import { CACHE_SERVICE_TOKEN } from './cache.interface';

@Global()
@Module({
  providers: [
    MemoryCacheService,
    {
      provide: CACHE_SERVICE_TOKEN,
      useExisting: MemoryCacheService,
    },
  ],
  exports: [MemoryCacheService, CACHE_SERVICE_TOKEN],
})
export class CacheModule {}
