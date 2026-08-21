import { Test, TestingModule } from '@nestjs/testing';
import { DebugController } from './debug.controller';
import { ProviderManager } from '../providers/provider.manager';
import { MemoryCacheService } from '../cache/memory-cache.service';
import { ConfigService } from '@nestjs/config';
import { IpoSyncService } from '../providers/sync/ipo-sync.service';
import { DRIZZLE_CONNECTION } from '../database/database.module';

import { AppLogger } from '../utils/logger';

describe('DebugController Integration Tests', () => {
  let controller: DebugController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DebugController],
      providers: [
        AppLogger,

        {
          provide: ProviderManager,
          useValue: {
            checkAllProvidersHealth: jest
              .fn()
              .mockResolvedValue({ stock: { status: 'healthy' } }),
            getCircuitState: jest.fn().mockReturnValue('CLOSED'),
            getAiProvider: jest.fn().mockReturnValue({
              checkHealth: jest.fn().mockResolvedValue({
                status: 'healthy',
                model: 'oc/big-pickle',
              }),
            }),
          },
        },
        {
          provide: MemoryCacheService,
          useValue: {
            getStats: jest.fn().mockReturnValue({
              totalKeys: 5,
              hits: 10,
              misses: 2,
              hitRatio: 0.83,
            }),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: () => 'oc/big-pickle' },
        },
        {
          provide: IpoSyncService,
          useValue: {
            syncIpos: jest.fn().mockResolvedValue({
              status: 'success',
              fetched: 0,
              inserted: 0,
              updated: 0,
              gmpUpdated: 0,
              subscriptionUpdated: 0,
              skipped: 0,
              error: null,
            }),
          },
        },
        {
          provide: DRIZZLE_CONNECTION,
          useValue: {
            select: jest.fn().mockReturnValue({
              from: jest.fn().mockResolvedValue([{ count: 10 }]),
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<DebugController>(DebugController);
  });

  it('GET /debug/openai returns structured diagnostics', async () => {
    const res = await controller.getOpenAiDiagnostics();
    expect(res.success).toBe(true);
    expect(res.diagnostics.configuredModel).toBe('oc/big-pickle');
  });

  it('GET /debug/providers returns provider health overview', async () => {
    const res = await controller.getProvidersDiagnostics();
    expect(res.success).toBe(true);
    expect(res.circuitState).toBe('CLOSED');
  });

  it('GET /debug/cache returns cache metrics', () => {
    const res = controller.getCacheDiagnostics();
    expect(res.success).toBe(true);
    expect(res.cacheStats.totalKeys).toBe(5);
  });

  it('GET /debug/runtime returns uptime and memory', () => {
    const res = controller.getRuntimeDiagnostics();
    expect(res.success).toBe(true);
    expect(res.runtime).toHaveProperty('memoryUsage');
  });
});
