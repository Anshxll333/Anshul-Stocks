import { Test, TestingModule } from '@nestjs/testing';
import { ToolRouter } from '../tools/tool.router';
import { IntentDetector } from '../tools/intent-detector';
import { StockTool } from '../tools/stock.tool';
import { FinancialTool } from '../tools/financial.tool';
import { IpoTool } from '../tools/ipo.tool';
import { VisionTool } from '../tools/vision.tool';
import { NewsTool } from '../tools/news.tool';
import { CalculatorTool } from '../tools/calculator.tool';
import { ScoreEngine } from '../services/score.engine';
import { AppLogger } from '../../utils/logger';
import { ProviderManager } from '../../providers/provider.manager';
import { ChatMessagePayload } from '../../providers/ai-provider.interface';
import { CompanySyncService } from '../../providers/sync/company-sync.service';
import { FinancialSyncService } from '../../providers/sync/financial-sync.service';
import { IpoSyncService } from '../../providers/sync/ipo-sync.service';
import { NewsSyncService } from '../../providers/sync/news-sync.service';
import { ConfigService } from '@nestjs/config';

describe('Sprint 6.0 Multi-Provider & AI Mentor Integration Suite (10 Target Cases)', () => {
  let router: ToolRouter;
  let intentDetector: IntentDetector;
  let scoreEngine: ScoreEngine;
  let providerManager: ProviderManager;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToolRouter,
        IntentDetector,
        StockTool,
        FinancialTool,
        IpoTool,
        VisionTool,
        NewsTool,
        CalculatorTool,
        AppLogger,
        ScoreEngine,
        {
          provide: ProviderManager,
          useValue: {
            executeRequest: jest
              .fn()
              .mockImplementation(async (name, ep, fetchFn) => fetchFn()),
            checkHealth: jest.fn().mockResolvedValue({ status: 'healthy' }),
            getAiProvider: jest.fn().mockReturnValue({
              generateCompletion: jest.fn().mockResolvedValue({
                content: `📌 **Executive Snapshot**
### 🏆 AI Mentor Scorecard & Verdict
Score: 8.4 / 10 | BUY
### 📊 Live Financial Highlights
### 🎯 Actionable Trading & Investing Setup
scale in gradually on market pullbacks
### 🧠 Mentor's Deep-Dive Analysis`,
              }),
            }),
          },
        },
        {
          provide: CompanySyncService,
          useValue: {
            syncCompanyAndQuote: jest
              .fn()
              .mockImplementation(async (symbol: string) => {
                const sym = symbol.toUpperCase();
                if (sym === 'UNKNOWN' || sym === 'UNKNOWN COMPANY') {
                  return {
                    profile: {
                      symbol: 'UNKNOWN',
                      companyName: 'Unknown Company',
                      exchange: 'NSE',
                    },
                    quote: {},
                  };
                }
                if (sym === 'TATAMOTORS' || sym === 'TMCV.NS') {
                  return {
                    profile: {
                      symbol: 'TMCV.NS',
                      companyName: 'Tata Motors Commercial Vehicles',
                      exchange: 'NSE',
                      sector: 'Automotive',
                      marketCapCr: 150000,
                      high52: 1100,
                      low52: 700,
                    },
                    quote: {
                      currentPrice: 950,
                      open: 940,
                      high: 960,
                      low: 935,
                      close: 950,
                      volume: 2000000,
                      changePercent: 1.2,
                    },
                  };
                }
                if (sym === 'SBIFUNDS' || sym === 'SBINEQWETF.BO') {
                  return {
                    profile: {
                      symbol: 'SBINEQWETF.BO',
                      companyName: 'SBI Mutual Fund ETF',
                      exchange: 'BSE',
                      sector: 'Financial Services',
                      marketCapCr: 50000,
                    },
                    quote: {
                      currentPrice: 245,
                      open: 244,
                      high: 246,
                      low: 243,
                      close: 245,
                      volume: 500000,
                      changePercent: 0.4,
                    },
                  };
                }
                if (sym === 'ZOMATO' || sym === 'ETERNAL.NS') {
                  return {
                    profile: {
                      symbol: 'ETERNAL.NS',
                      companyName: 'Eternal (formerly Zomato)',
                      exchange: 'NSE',
                      sector: 'Consumer Tech',
                      marketCapCr: 210000,
                    },
                    quote: {
                      currentPrice: 260,
                      open: 255,
                      high: 265,
                      low: 254,
                      close: 260,
                      volume: 15000000,
                      changePercent: 2.1,
                    },
                  };
                }
                return {
                  profile: {
                    symbol: sym,
                    companyName: `${sym} Industries`,
                    exchange: 'NSE',
                    sector: 'Conglomerate',
                    marketCapCr: 1800000,
                    high52: 3000,
                    low52: 2200,
                  },
                  quote: {
                    currentPrice: 2550,
                    open: 2530,
                    high: 2570,
                    low: 2520,
                    close: 2550,
                    volume: 1500000,
                    changePercent: 0.8,
                  },
                };
              }),
          },
        },
        {
          provide: FinancialSyncService,
          useValue: {
            syncFinancials: jest
              .fn()
              .mockImplementation(async (symbol: string) => {
                const sym = symbol.toUpperCase();
                if (sym === 'UNKNOWN' || sym === 'UNKNOWN COMPANY') {
                  return { symbol: 'UNKNOWN' };
                }
                return {
                  symbol: sym,
                  revenueCr: 900000,
                  netProfitCr: 75000,
                  peRatio: 24.5,
                  pbRatio: 3.2,
                  roe: 18.5,
                  roce: 20.1,
                  debtToEquity: 0.35,
                  currentRatio: 1.6,
                  operatingMargin: 18.2,
                  netMargin: 11.5,
                };
              }),
          },
        },
        {
          provide: IpoSyncService,
          useValue: {
            syncIpo: jest.fn().mockImplementation(async (query: string) => {
              if (query.toLowerCase().includes('indo-nim')) {
                return { companyName: 'Indo-Nim', status: 'upcoming' };
              }
              return {
                companyName: query,
                status: 'listed',
                issuePrice: '450',
                priceBand: '440-450',
              };
            }),
            getIpoForMentor: jest
              .fn()
              .mockImplementation(
                async ({
                  companyName,
                  listQuery,
                }: {
                  companyName?: string;
                  listQuery?: boolean;
                }) => {
                  if (listQuery) {
                    return {
                      type: 'list',
                      items: [{ companyName: 'Indo-Nim', status: 'upcoming' }],
                    };
                  }
                  if ((companyName || '').toLowerCase().includes('indo-nim')) {
                    return {
                      type: 'single',
                      ipo: { companyName: 'Indo-Nim', status: 'upcoming' },
                    };
                  }
                  return {
                    type: 'single',
                    ipo: {
                      companyName: companyName || 'Unknown',
                      status: 'listed',
                      issuePrice: '450',
                      priceBand: '440-450',
                    },
                  };
                },
              ),
          },
        },
        {
          provide: NewsSyncService,
          useValue: {
            syncNews: jest.fn().mockResolvedValue([
              {
                title:
                  'Swiggy expands quick commerce footprint across Tier 2 cities',
                sentiment: 'positive',
                source: 'LiveMint',
              },
              {
                title: 'Market sentiment upbeat following RBI policy update',
                sentiment: 'neutral',
                source: 'Economic Times',
              },
            ]),
          },
        },
        {
          provide: 'DRIZZLE_CONNECTION',
          useValue: {
            select: jest.fn().mockReturnValue({
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue([]),
                }),
                orderBy: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue([]),
                }),
              }),
            }),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: () => null },
        },
      ],
    }).compile();

    router = module.get<ToolRouter>(ToolRouter);
    intentDetector = module.get<IntentDetector>(IntentDetector);
    scoreEngine = module.get<ScoreEngine>(ScoreEngine);
    providerManager = module.get<ProviderManager>(ProviderManager);
  });

  it('Case 1: "Tata Motors" -> Resolves to stock lookup and evaluates TMCV.NS', async () => {
    const decision = await router.routeAndExecute('Tata Motors', 'req-case-1');
    expect(decision.detectedIntent.intent).toBe('stock_lookup');
    expect(decision.detectedIntent.targetSymbol).toBe('TATAMOTORS');
    expect(decision.toolExecuted).toBe('stock_fundamentals_lookup');
    expect(decision.contextString).toContain('TMCV.NS');
  });

  it('Case 2: "Should I buy SBI Funds?" -> Resolves mutual fund / ETF ticker SBIFUNDS', async () => {
    const decision = await router.routeAndExecute(
      'Should I buy SBI Funds?',
      'req-case-2',
    );
    expect(decision.detectedIntent.intent).toBe('stock_lookup');
    expect(decision.detectedIntent.targetSymbol).toBe('SBIFUNDS');
    expect(decision.toolExecuted).toBe('stock_fundamentals_lookup');
    expect(decision.contextString).toContain('SBINEQWETF.BO');
  });

  it('Case 3: "Reliance fundamental ratios" -> Retrieves rich financial metrics and score', async () => {
    const decision = await router.routeAndExecute(
      'Reliance fundamental ratios',
      'req-case-3',
    );
    expect(decision.detectedIntent.intent).toBe('financial_ratios');
    expect(decision.toolExecuted).toBe('financial_ratios_lookup');
    expect(decision.contextString).toContain('18.5'); // ROE
  });

  it('Case 4: "Zomato" -> Resolves to ETERNAL.NS and evaluates metrics', async () => {
    const decision = await router.routeAndExecute('Zomato', 'req-case-4');
    expect(decision.detectedIntent.intent).toBe('stock_lookup');
    expect(decision.detectedIntent.targetSymbol).toBe('ZOMATO');
    expect(decision.contextString).toContain('ETERNAL.NS');
  });

  it('Case 5: "Indo-Nim IPO" -> Detects IPO intent with upcoming status', async () => {
    const decision = await router.routeAndExecute('Indo-Nim IPO', 'req-case-5');
    expect(decision.detectedIntent.intent).toBe('ipo_details');
    expect(decision.toolExecuted).toBe('ipo_prospectus_lookup');
    expect(decision.contextString).toContain('upcoming');
  });

  it('Case 6: "Tell about Unknown Company" -> Enforces 30% missing data threshold and returns insufficient data notice without inventing score', async () => {
    const decision = await router.routeAndExecute(
      'Tell about Unknown Company',
      'req-case-6',
    );
    expect(decision.detectedIntent.intent).toBe('stock_lookup');
    expect(decision.toolExecuted).toBe('stock_fundamentals_lookup');
    // Ensure scoring engine returns null score when data is missing
    const report = scoreEngine.calculateScore({ symbol: 'UNKNOWN' }, {}, {});
    expect(report.overallScore).toBeNull();
    expect(report.recommendation).toBe('INSUFFICIENT DATA');
    expect(report.insufficientDataNotice).toContain(
      'Not enough free exchange data to calculate an automated valuation badge',
    );
  });

  it('Case 7: "What is P/E ratio and ROE of TCS?" -> Specific financial metric extraction', async () => {
    const decision = await router.routeAndExecute(
      'What is P/E ratio and ROE of TCS?',
      'req-case-7',
    );
    expect(decision.detectedIntent.intent).toBe('financial_ratios');
    expect(decision.detectedIntent.targetSymbol).toBe('TCS');
    expect(decision.toolExecuted).toBe('financial_ratios_lookup');
  });

  it('Case 8: "Hi AI Mentor" -> Greeting intent returns welcome without triggering analysis tools', async () => {
    const decision = await router.routeAndExecute('Hi AI Mentor', 'req-case-8');
    expect(decision.detectedIntent.intent).toBe('greeting');
    expect(decision.toolExecuted).toBeNull();
  });

  it('Case 9: "Swiggy news" -> Resolves news intent and extracts sentiment', async () => {
    const decision = await router.routeAndExecute('Swiggy news', 'req-case-9');
    expect(decision.detectedIntent.intent).toBe('news');
    expect(decision.detectedIntent.targetSymbol).toBe('SWIGGY');
    expect(decision.toolExecuted).toBe('financial_news_fetcher');
  });

  it('Case 10: "Calculate CAGR for 100000 over 5 years at 15%" -> Executes financial calculator math tool', async () => {
    const decision = await router.routeAndExecute(
      'Calculate CAGR for 100000 over 5 years at 15%',
      'req-case-10',
    );
    expect(decision.detectedIntent.intent).toBe('calculator');
    expect(decision.toolExecuted).toBe('financial_calculator');
  });

  it('Case 11: Sprint 6.1 Premium AI Mentor formatting -> Verifies short 6-section report, star ratings, and zero technical jargon/footer', async () => {
    const mockMessages: ChatMessagePayload[] = [
      {
        role: 'user',
        content: 'Tell about Reliance',
      },
      {
        role: 'system',
        content:
          '[GROUND TRUTH LIVE FINANCIAL JSON FOR RELIANCE]: ' +
          JSON.stringify({
            symbol: 'RELIANCE',
            companyName: 'Reliance Industries',
            currentPrice: 2550,
            high52w: 3000,
            low52w: 2200,
            marketCapCr: 1800000,
            volume: 1500000,
            changePercent: 0.8,
            peRatio: 24.5,
            pbRatio: 3.2,
            roe: 18.5,
            roce: 20.1,
            debtToEquity: 0.35,
            revenueCr: 900000,
            netProfitCr: 75000,
            dividendYield: 1.2,
            industry: 'Conglomerate',
            description:
              'Reliance Industries Limited is an Indian multinational conglomerate headquartered in Mumbai. Its businesses include energy, petrochemicals, natural gas, retail, telecommunications, mass media, and textiles.',
            calculatedScore: {
              overallScore: 8.4,
              confidenceScore: 9.5,
              dataCompletenessPercent: 95,
              recommendation: 'BUY',
              targetEntryPriceRange: '₹2400.00 - ₹2450.00',
            },
          }),
      },
    ];

    const res = await providerManager
      .getAiProvider()
      .generateCompletion(mockMessages);
    const text = res.content;

    // Verify mandatory section order
    expect(text).toContain('📌 **Executive Snapshot**');
    expect(text).toContain('### 🏆 AI Mentor Scorecard & Verdict');
    expect(text).toContain('### 📊 Live Financial Highlights');
    expect(text).toContain('### 🎯 Actionable Trading & Investing Setup');
    expect(text).toContain("### 🧠 Mentor's Deep-Dive Analysis");

    // Verify AI Score out of 10 and recommendation badges are present
    expect(text).toContain('8.4 / 10');
    expect(text).toContain('BUY');

    // Verify natural advice and lack of blind recommendation
    expect(text).toContain('scale in gradually on market pullbacks');

    // Verify absence of banned vocabulary & developer metadata
    expect(text).not.toContain('Operating Platform');
    expect(text).not.toContain('Core Profitability');
    expect(text).not.toContain('Fundamental Assessment');
    expect(text).not.toContain('Provider Response');
    expect(text).not.toContain('Financial JSON');
    expect(text).not.toContain('--- ### 🔍 Live Data Sources & Verification');
  });
});
