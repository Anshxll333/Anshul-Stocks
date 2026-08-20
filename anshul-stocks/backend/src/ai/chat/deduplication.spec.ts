import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { ProviderManager } from '../../providers/provider.manager';
import { ToolRouter } from '../tools/tool.router';
import { ContextService } from './context.service';
import { AppLogger } from '../../utils/logger';
import { DRIZZLE_CONNECTION } from '../../database/database.module';

describe('Duplicate Message Elimination & Request Locking Tests', () => {
  let service: ChatService;

  beforeEach(async () => {
    const mockDb: any = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest
        .fn()
        .mockResolvedValue([
          { id: 1, role: 'assistant', content: 'Previous msg' },
        ]),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest
        .fn()
        .mockResolvedValue([{ id: 99, role: 'user', content: 'Test query' }]),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        AppLogger,
        {
          provide: DRIZZLE_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: ProviderManager,
          useValue: {
            getAiProvider: jest.fn().mockReturnValue({
              generateCompletion: jest.fn().mockResolvedValue({
                content: 'AI Answer',
                model: 'oc/big-pickle',
                totalTokens: 120,
                promptTokens: 80,
                completionTokens: 40,
                executionTimeMs: 150,
                status: 'completed',
              }),
            }),
          },
        },
        {
          provide: ToolRouter,
          useValue: {
            routeAndExecute: jest.fn().mockResolvedValue({
              detectedIntent: { intent: 'general', confidence: 0.9 },
              toolExecuted: null,
              result: null,
              providerUsed: 'InternalEngine',
              executionTimeMs: 10,
              contextJsonSize: 0,
            }),
          },
        },
        {
          provide: ContextService,
          useValue: {
            buildContextWindow: jest.fn().mockResolvedValue([
              { role: 'system', content: 'System' },
              { role: 'user', content: 'Test query' },
            ]),
          },
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should process first request successfully', async () => {
    const res = await service.processChatMessage(
      1,
      101,
      'Test query',
      'req-unique-1',
    );
    expect(res).toHaveProperty('requestId', 'req-unique-1');
    expect(res.conversationId).toBe(101);
  });

  it('should reject duplicate request with identical Request ID', async () => {
    await service.processChatMessage(1, 102, 'Test query', 'req-dup-id');
    await expect(
      service.processChatMessage(1, 102, 'Test query', 'req-dup-id'),
    ).rejects.toThrow('Duplicate request detected: req-dup-id');
  });
});
