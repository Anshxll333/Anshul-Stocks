import { MarketMapper } from '../mappers/market.mapper';
import { FinancialMapper } from '../mappers/financial.mapper';
import { IPOMapper } from '../mappers/ipo.mapper';
import { NewsMapper } from '../mappers/news.mapper';
import { DtoValidatorService } from '../validation/dto-validator.service';
import { ProviderManager } from '../provider.manager';
import { ProviderValidationException } from '../../common/exceptions/provider-typed.exception';

describe('Sprint 5.6 Hardening & Strict Null Policy Tests', () => {
  let validator: DtoValidatorService;

  beforeEach(() => {
    validator = new DtoValidatorService();
  });

  it('MarketMapper must map missing provider fields to NULL instead of hardcoded numbers', () => {
    const rawEmpty = {};
    const dto = MarketMapper.toQuoteDTO(rawEmpty, 'XYZ');

    expect(dto.symbol).toBe('XYZ');
    expect(dto.currentPrice).toBeNull();
    expect(dto.open).toBeNull();
    expect(dto.high).toBeNull();
    expect(dto.low).toBeNull();
    expect(dto.volume).toBeNull();
    expect(dto.high52w).toBeUndefined();
    expect(dto.low52w).toBeUndefined();
  });

  it('FinancialMapper must map missing ratios to NULL without inventing fake data', () => {
    const rawEmpty = {};
    const dto = FinancialMapper.toMetricDTO(rawEmpty, 'XYZ');

    expect(dto.symbol).toBe('XYZ');
    expect(dto.revenueCr).toBeNull();
    expect(dto.netProfitCr).toBeNull();
    expect(dto.eps).toBeNull();
    expect(dto.peRatio).toBeNull();
    expect(dto.roe).toBeNull();
    expect(dto.roce).toBeNull();
  });

  it('IPOMapper must map missing filings to NULL without fabricating prices or GMP', () => {
    const rawEmpty = {};
    const dto = IPOMapper.toIPODTO(rawEmpty);

    expect(dto.issuePrice).toBeNull();
    expect(dto.priceBand).toBeNull();
    expect(dto.lotSize).toBeNull();
    expect(dto.gmp).toBeNull();
    expect(dto.listingGainPercent).toBeNull();
  });

  it('NewsMapper must return empty array if 0 news items are returned by provider', () => {
    const emptyList = NewsMapper.toArticleList([], 'XYZ');
    expect(emptyList).toEqual([]);
  });

  it('DtoValidatorService should throw ProviderValidationException on invalid/NaN fields', () => {
    const badQuote: any = {
      symbol: 'INVALID',
      currentPrice: NaN,
      volume: -500,
      timestamp: 'invalid-date',
    };

    expect(() => validator.validateMarketQuote(badQuote)).toThrow(
      ProviderValidationException,
    );
  });

  it('ProviderManager Circuit Breaker should trip to OPEN after consecutive failures', async () => {
    const mockDb: any = {
      insert: jest
        .fn()
        .mockReturnValue({ values: jest.fn().mockResolvedValue(true) }),
    };
    const mockConfig: any = {
      get: jest
        .fn()
        .mockImplementation((key: string) =>
          key === 'provider.retryAttempts' ? 1 : 10000,
        ),
    };
    const mockLogger: any = { logStructured: jest.fn() };

    const mockGroqProvider: any = {};
    const mockOpenAiProvider: any = {};

    const manager = new ProviderManager(
      mockDb,
      mockConfig,
      mockLogger,
      mockGroqProvider,
      mockOpenAiProvider,
    );
    const failingFn = jest.fn().mockRejectedValue(new Error('API Failure'));

    for (let i = 0; i < 5; i++) {
      try {
        await manager.executeRequest('TestProvider', '/test', failingFn);
      } catch (e) {
        // Expected failing calls
      }
    }

    expect(manager.getCircuitState()).toBe('OPEN');
  });
});
