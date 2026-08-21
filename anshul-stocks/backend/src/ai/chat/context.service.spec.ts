import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ContextService } from './context.service';
import { DRIZZLE_CONNECTION } from '../../database/database.module';
import { PromptBuilder } from '../prompts/prompt.builder';
import { AppLogger } from '../../utils/logger';
import { ChatMessagePayload } from '../../providers/ai-provider.interface';

describe('ContextService', () => {
  let service: ContextService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      switch (key) {
        case 'ai.maxContextMessages':
          return 8;
        case 'ai.maxContextMessageChars':
          return 1500;
        case 'ai.maxContextUserMessageChars':
          return 600;
        case 'ai.maxHistoryBytes':
          return 12000;
        default:
          return undefined;
      }
    }),
  };

  const mockPromptBuilder = {
    buildSystemPrompt: jest.fn().mockReturnValue('SYSTEM PROMPT'),
  };

  const mockLogger = {
    logStageTimeline: jest.fn(),
  };

  const buildService = async (dbRows: any[]): Promise<ContextService> => {
    const mockDb = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue(dbRows),
            }),
          }),
        }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextService,
        { provide: DRIZZLE_CONNECTION, useValue: mockDb },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PromptBuilder, useValue: mockPromptBuilder },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    return module.get<ContextService>(ContextService);
  };

  const makeRow = (role: string, content: string, id: number) => ({
    id,
    role,
    content,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return system prompt, chronological history, then current user prompt', async () => {
    // DB query returns newest-first; service must restore chronological order
    service = await buildService([
      makeRow('user', 'newest user msg', 3),
      makeRow('assistant', 'oldest assistant msg', 2),
      makeRow('user', 'oldest user msg', 1),
    ]);

    const payload = await service.buildContextWindow(1, 'current prompt');

    expect(payload[0]).toEqual({ role: 'system', content: 'SYSTEM PROMPT' });
    // History must be in chronological order (oldest first)
    expect(payload[1]).toEqual({ role: 'user', content: 'oldest user msg' });
    expect(payload[2]).toEqual({
      role: 'assistant',
      content: 'oldest assistant msg',
    });
    expect(payload[3]).toEqual({ role: 'user', content: 'newest user msg' });
    // Current prompt is appended last
    expect(payload[4]).toEqual({ role: 'user', content: 'current prompt' });
  });

  it('should truncate oversized assistant messages (JSON decision cards)', async () => {
    const bigAssistant = `{"type":"stock","details":"${'x'.repeat(3000)}"}`;
    service = await buildService([makeRow('assistant', bigAssistant, 1)]);

    const payload = await service.buildContextWindow(1, 'hello');

    const history = payload[1];
    expect(history.content).toContain('...[context truncated]');
    // content = first 1500 chars + truncation suffix
    expect(history.content.length).toBe(
      1500 + '\n...[context truncated]'.length,
    );
    // The critical head of the JSON card is preserved
    expect(history.content.startsWith('{"type":"stock"')).toBe(true);
  });

  it('should truncate oversized user messages at the user cap', async () => {
    const bigUser = `tell me everything ${'y'.repeat(2000)}`;
    service = await buildService([makeRow('user', bigUser, 1)]);

    const payload = await service.buildContextWindow(1, 'hello');

    const history = payload[1];
    expect(history.content).toContain('...[context truncated]');
    expect(history.content.length).toBe(
      600 + '\n...[context truncated]'.length,
    );
  });

  it('should keep the newest messages and drop the oldest when the history byte cap is exceeded', async () => {
    // Truncation runs first (assistant → 1500 chars, user → 600 chars), so use a
    // small byte cap to force oldest messages to be dropped even after truncation.
    const rows = [
      makeRow('assistant', `newest ${'n'.repeat(7000)}`, 3),
      makeRow('user', `middle ${'m'.repeat(7000)}`, 2),
      makeRow('user', `oldest ${'o'.repeat(7000)}`, 1),
    ];
    service = await buildService(rows);
    (service as any).maxHistoryBytes = 2500;

    const payload = await service.buildContextWindow(1, 'current');

    const history = payload.slice(1, payload.length - 1);
    expect(history.length).toBe(2);
    // Chronological order preserved among the kept messages
    expect(history[0].content).toContain('middle');
    expect(history[1].content).toContain('newest');
  });

  it('should append tool context to the current user prompt', async () => {
    service = await buildService([]);

    const payload = await service.buildContextWindow(
      1,
      'tell me about RELIANCE',
      '[GROUND TRUTH ...]',
    );

    const last = payload[payload.length - 1];
    expect(last.content).toBe('tell me about RELIANCE\n\n[GROUND TRUTH ...]');
  });
});
