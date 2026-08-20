import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { ProviderManager } from '../../providers/provider.manager';
import { ToolRouter } from '../tools/tool.router';
import { ContextService } from './context.service';
import { AppLogger } from '../../utils/logger';
import { DRIZZLE_CONNECTION } from '../../database/database.module';

describe('ChatService Integration Tests', () => {
  let service: ChatService;

  const mockDb = {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest
            .fn()
            .mockResolvedValue([{ id: 1, email: 'demo@anshulstocks.com' }]),
          orderBy: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }),
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest
          .fn()
          .mockResolvedValue([{ id: 101, userId: 1, title: 'Test Conv' }]),
        onConflictDoNothing: jest.fn().mockResolvedValue(true),
      }),
    }),
    update: jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(true),
      }),
    }),
  };

  const mockProviderManager = {
    getAiProvider: jest.fn().mockReturnValue({
      generateCompletion: jest.fn().mockResolvedValue({
        content: 'Test AI response',
        model: 'oc/big-pickle',
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
        executionTimeMs: 150,
        status: 'completed',
      }),
      generateStream: jest.fn().mockImplementation(async function* () {
        yield 'Hello ';
        yield 'world!';
      }),
    }),
  };

  const mockToolRouter = {
    routeAndExecute: jest.fn().mockResolvedValue({
      toolExecuted: null,
      detectedIntent: { intent: 'general', confidence: 0.9 },
      providerUsed: 'InternalEngine',
      contextString: '',
    }),
  };

  const mockContextService = {
    buildContextWindow: jest
      .fn()
      .mockResolvedValue([{ role: 'user', content: 'hello' }]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        AppLogger,
        { provide: DRIZZLE_CONNECTION, useValue: mockDb },
        { provide: ProviderManager, useValue: mockProviderManager },
        { provide: ToolRouter, useValue: mockToolRouter },
        { provide: ContextService, useValue: mockContextService },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should process chat message and return structured response', async () => {
    const res = await service.processChatMessage(
      1,
      null,
      'Test prompt',
      'req-test-single',
    );
    expect(res).toHaveProperty('conversationId', 101);
    expect(res).toHaveProperty('requestId', 'req-test-single');
    expect(res).toHaveProperty('metrics');
  });

  it('should suppress duplicate request IDs', async () => {
    const reqId = 'req-dup-check';
    await service.processChatMessage(1, 101, 'Hello prompt', reqId);
    await expect(
      service.processChatMessage(1, 101, 'Hello prompt', reqId),
    ).rejects.toThrow('Duplicate request detected');
  });

  it('should initiate stream generator correctly', async () => {
    const streamRes = await service.processChatStream(
      1,
      101,
      'Stream prompt',
      'req-stream-test',
    );
    expect(streamRes).toHaveProperty('convId', 101);
    expect(streamRes).toHaveProperty('requestId', 'req-stream-test');

    const chunks: string[] = [];
    for await (const chunk of streamRes.stream) {
      chunks.push(chunk);
    }
    expect(chunks.join('')).toBe('Hello world!');
  });
});
