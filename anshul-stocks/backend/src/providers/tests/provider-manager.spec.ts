import { ProviderManager } from '../provider.manager';

describe('ProviderManager Tests', () => {
  let providerManager: ProviderManager;
  let mockDb: any;
  let mockConfig: any;
  let mockLogger: any;
  let mockGroqProvider: any;
  let mockOpenAiProvider: any;

  beforeEach(() => {
    mockDb = {
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockResolvedValue(true),
      }),
    };
    mockConfig = {
      get: jest.fn((key: string) => {
        if (key === 'provider.retryAttempts') return 2;
        if (key === 'provider.providerTimeoutMs') return 2000;
        return null;
      }),
    };
    mockLogger = {
      logStructured: jest.fn(),
    };
    mockGroqProvider = {};
    mockOpenAiProvider = {};

    providerManager = new ProviderManager(
      mockDb,
      mockConfig,
      mockLogger,
      mockGroqProvider,
      mockOpenAiProvider,
    );
  });

  it('should successfully execute primary provider request', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ price: 2850.5 });
    const result = await providerManager.executeRequest(
      'TwelveData',
      '/quote',
      fetchFn,
    );

    expect(result).toEqual({ price: 2850.5 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('should invoke fallback handler if primary provider fails', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error('Primary API down'));
    const fallbackFn = jest
      .fn()
      .mockResolvedValue({ price: 2800.0, isFallback: true });

    const result = await providerManager.executeRequest(
      'Primary',
      '/quote',
      fetchFn,
      fallbackFn,
    );

    expect(result).toEqual({ price: 2800.0, isFallback: true });
    expect(fallbackFn).toHaveBeenCalledTimes(1);
  });

  it('should pass health check test', async () => {
    const health = await providerManager.checkHealth('TwelveData');
    expect(health.status).toBeDefined();
    expect(health.providerName).toBe('TwelveData');
  });
});
