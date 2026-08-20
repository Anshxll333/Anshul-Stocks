import { Controller, Get, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DRIZZLE_CONNECTION } from './database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { ProviderManager } from './providers/provider.manager';
import { MemoryCacheService } from './cache/memory-cache.service';

@Controller()
export class AppController {
  constructor(
    @Inject(DRIZZLE_CONNECTION) private readonly db: NodePgDatabase<any>,
    private readonly configService: ConfigService,
    private readonly providerManager: ProviderManager,
    private readonly cacheService: MemoryCacheService,
  ) {}

  @Get()
  getIndex() {
    return {
      success: true,
      message:
        'Welcome to Anshul Stocks AI Platform. Access health metrics at /health and diagnostics at /debug/runtime.',
    };
  }

  @Get(['health', 'api/health'])
  async getHealth() {
    let dbStatus: 'healthy' | 'down' = 'down';
    try {
      await this.db.execute(sql`SELECT 1`);
      dbStatus = 'healthy';
    } catch {
      dbStatus = 'down';
    }

    const aiProviderHealth = await this.providerManager
      .getAiProvider()
      .checkHealth();
    const providersHealth =
      await this.providerManager.checkAllProvidersHealth();
    const cacheStats = this.cacheService.getStats();

    // Determine overall system status: Healthy, Degraded, or Down
    let overallStatus: 'Healthy' | 'Degraded' | 'Down' = 'Healthy';
    if (dbStatus === 'down') {
      overallStatus = 'Down';
    } else if (aiProviderHealth.status === 'down') {
      overallStatus = 'Degraded';
    } else if (
      Object.values(providersHealth).some((p) => p.status === 'down')
    ) {
      overallStatus = 'Degraded';
    }

    return {
      success: true,
      status: overallStatus,
      app: 'Anshul Stocks AI Platform',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      environment: this.configService.get<string>('NODE_ENV') || 'development',
      subsystems: {
        database: { status: dbStatus },
        aiProvider: aiProviderHealth,
        providers: providersHealth,
        cache: {
          status: 'healthy',
          totalKeys: cacheStats.totalKeys,
          hitRatio: cacheStats.hitRatio,
        },
      },
    };
  }
}
