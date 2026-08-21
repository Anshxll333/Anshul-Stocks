import { Controller, Get, Post, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProviderManager } from '../providers/provider.manager';
import { MemoryCacheService } from '../cache/memory-cache.service';
import { IpoSyncService } from '../providers/sync/ipo-sync.service';
import { DRIZZLE_CONNECTION } from '../database/database.module';
import type { DrizzleDB } from '../database/database.module';
import { conversations, messages, ipoData } from '../database/schema';
import { sql } from 'drizzle-orm';
import { AppLogger } from '../utils/logger';

@Controller('debug')
export class DebugController {
  constructor(
    private readonly appLogger: AppLogger,
    private readonly providerManager: ProviderManager,
    private readonly cacheService: MemoryCacheService,
    private readonly configService: ConfigService,
    private readonly ipoSyncService: IpoSyncService,
    @Inject(DRIZZLE_CONNECTION) private readonly db: DrizzleDB,
  ) {}

  @Get('openai')
  async getOpenAiDiagnostics() {
    const health = await this.providerManager.getAiProvider().checkHealth();
    return {
      success: true,
      timestamp: new Date().toISOString(),
      diagnostics: {
        configuredModel:
          this.configService.get<string>('ai.defaultModel') ||
          process.env.AI_MODEL,
        hasApiKey: !!(
          process.env.OPENAI_API_KEY &&
          process.env.OPENAI_API_KEY !== 'your_openai_api_key_here'
        ),
        maxTokens: this.configService.get<number>('ai.maxTokens') || 2048,
        temperature: this.configService.get<number>('ai.temperature') || 0.2,
        health,
      },
    };
  }

  @Get('providers')
  async getProvidersDiagnostics() {
    const allHealth = await this.providerManager.checkAllProvidersHealth();
    return {
      success: true,
      timestamp: new Date().toISOString(),
      circuitState: this.providerManager.getCircuitState(),
      providers: allHealth,
    };
  }

  @Get('chat')
  async getChatDiagnostics() {
    let conversationCount = 0;
    let messageCount = 0;

    try {
      const [convRes] = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(conversations);
      const [msgRes] = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(messages);
      conversationCount = Number(convRes?.count || 0);
      messageCount = Number(msgRes?.count || 0);
    } catch {
      // Database count query fallback
    }

    return {
      success: true,
      timestamp: new Date().toISOString(),
      diagnostics: {
        totalConversations: conversationCount,
        totalMessages: messageCount,
        supportedModels: ['mistral/mistral-small-latest'],
        intentTypes: [
          'stock_lookup',
          'financial_ratios',
          'ipo_details',
          'news',
          'calculator',
          'general',
        ],
        pipelineStages: [
          'CREATED',
          'SENT',
          'PROCESSING',
          'ROUTING',
          'PROVIDER',
          'PROMPT',
          'OPENAI',
          'STREAMING',
          'COMPLETED',
        ],
      },
    };
  }

  /**
   * Manual IPO synchronization trigger (testing only — not used by the
   * frontend). The production path is the hourly IpoSchedulerService cron.
   */
  @Post('ipo-sync')
  async manualIpoSync() {
    const result = await this.ipoSyncService.syncIpos();
    return {
      success: result.status !== 'failed',
      timestamp: new Date().toISOString(),
      result,
    };
  }

  @Get('ipo-status')
  async getIpoStatus() {
    let count = 0;
    try {
      const [res] = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(ipoData);
      count = Number(res?.count || 0);
    } catch {
      // DB not reachable — report 0
    }
    return {
      success: true,
      timestamp: new Date().toISOString(),
      diagnostics: {
        totalIposInDb: count,
        provider: this.configService.get<string>('IPO_PROVIDER') || 'finapi',
        syncInterval: '1h',
      },
    };
  }

  @Get('cache')
  getCacheDiagnostics() {
    const stats = this.cacheService.getStats();
    return {
      success: true,
      timestamp: new Date().toISOString(),
      cacheStats: stats,
    };
  }

  @Get('runtime')
  getRuntimeDiagnostics() {
    const memory = process.memoryUsage();
    return {
      success: true,
      timestamp: new Date().toISOString(),
      runtime: {
        uptimeSeconds: Math.floor(process.uptime()),
        nodeVersion: process.version,
        environment:
          this.configService.get<string>('NODE_ENV') || 'development',
        memoryUsage: {
          heapUsedMb: Number((memory.heapUsed / 1024 / 1024).toFixed(2)),
          heapTotalMb: Number((memory.heapTotal / 1024 / 1024).toFixed(2)),
          rssMb: Number((memory.rss / 1024 / 1024).toFixed(2)),
        },
      },
    };
  }
}
