import { Test, TestingModule } from '@nestjs/testing';
import { ToolRouter } from './tool.router';
import { IntentDetector } from './intent-detector';
import { StockTool } from './stock.tool';
import { FinancialTool } from './financial.tool';
import { IpoTool } from './ipo.tool';
import { VisionTool } from './vision.tool';
import { NewsTool } from './news.tool';
import { CalculatorTool } from './calculator.tool';
import { ScoreEngine } from '../services/score.engine';
import { AppLogger } from '../../utils/logger';
import { ProviderManager } from '../../providers/provider.manager';
import { CompanySyncService } from '../../providers/sync/company-sync.service';
import { FinancialSyncService } from '../../providers/sync/financial-sync.service';
import { IpoSyncService } from '../../providers/sync/ipo-sync.service';
import { NewsSyncService } from '../../providers/sync/news-sync.service';
import { ConfigService } from '@nestjs/config';

describe('ToolRouter Integration Tests', () => {
  let router: ToolRouter;

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
        {
          provide: ScoreEngine,
          useValue: {
            calculateScore: jest.fn().mockReturnValue({
              symbol: 'RELIANCE',
              companyName: 'Reliance Industries',
              overallScore: 8.4,
              confidenceScore: 9.0,
              dataCompletenessPercent: 95,
              recommendation: 'BUY (ACCUMULATE ON DIPS)',
              targetEntryPriceRange: '₹2400.00 - ₹2500.00',
              categories: {},
            }),
          },
        },
        {
          provide: ProviderManager,
          useValue: {
            executeRequest: jest
              .fn()
              .mockImplementation(async (name, ep, fetchFn) => fetchFn()),
            checkHealth: jest.fn().mockResolvedValue({ status: 'healthy' }),
          },
        },
        {
          provide: CompanySyncService,
          useValue: {
            syncCompanyAndQuote: jest.fn().mockResolvedValue({
              profile: {
                symbol: 'RELIANCE',
                companyName: 'Reliance Industries',
                exchange: 'NSE',
                sector: 'Energy',
                industry: 'Oil & Gas',
                marketCapCr: 1800000,
                high52: 3000,
                low52: 2200,
                description: 'Energy Conglomerate',
              },
              quote: {
                currentPrice: 2550,
                open: 2530,
                high: 2570,
                low: 2520,
                close: 2550,
                volume: 1500000,
                changePercent: 0.8,
                timestamp: new Date().toISOString(),
              },
            }),
          },
        },
        {
          provide: FinancialSyncService,
          useValue: {
            syncFinancials: jest.fn().mockResolvedValue({
              symbol: 'RELIANCE',
              peRatio: 25.4,
              roe: '18.5%',
            }),
          },
        },
        {
          provide: IpoSyncService,
          useValue: {
            syncIpo: jest
              .fn()
              .mockResolvedValue({ companyName: 'Swiggy', status: 'ACTIVE' }),
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
                      items: [
                        {
                          companyName: 'Dhoot Transmission',
                          symbol: 'DHOOTTRANS',
                          status: 'upcoming',
                          priceRange: '₹207 - ₹219',
                          lotSize: 68,
                          issueSizeCr: 605.5,
                          openDate: '2026-08-12',
                          closeDate: '2026-08-14',
                          gmp: null,
                          gmpGainPercent: null,
                          totalSub: null,
                        },
                        {
                          companyName: 'Swiggy',
                          symbol: 'SWIGGY',
                          status: 'open',
                          priceRange: '₹371 - ₹390',
                          lotSize: 38,
                          issueSizeCr: 11327,
                          openDate: '2026-08-06',
                          closeDate: '2026-08-08',
                          gmp: 45,
                          gmpGainPercent: 13.2,
                          totalSub: 3.8,
                        },
                      ],
                    };
                  }
                  if ((companyName || '').toLowerCase().includes('dhoot')) {
                    return {
                      type: 'single',
                      ipo: {
                        companyName: 'Dhoot Transmission',
                        symbol: 'DHOOTTRANS',
                        status: 'upcoming',
                        priceRange: '₹207 - ₹219',
                        lotSize: 68,
                        issueSizeCr: 605.5,
                        openDate: '2026-08-12',
                        closeDate: '2026-08-14',
                        gmp: null,
                        gmpGainPercent: null,
                        totalSub: null,
                        aboutCompany:
                          'Dhoot Transmission manufactures automotive transmission components.',
                      },
                    };
                  }
                  return {
                    type: 'single',
                    ipo: {
                      companyName: companyName || 'Swiggy',
                      symbol: 'SWIGGY',
                      status: 'open',
                      priceRange: '₹371 - ₹390',
                      lotSize: 38,
                      issueSizeCr: 11327,
                      gmp: 45,
                      gmpGainPercent: 13.2,
                      totalSub: 3.8,
                    },
                  };
                },
              ),
          },
        },
        {
          provide: NewsSyncService,
          useValue: {
            syncNews: jest.fn().mockResolvedValue([{ title: 'Market rally' }]),
          },
        },
        {
          provide: 'DRIZZLE_CONNECTION',
          useValue: {
            select: jest.fn().mockReturnValue({
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue([
                    {
                      id: 1,
                      originalName: 'portfolio.png',
                      filepath: '/uploads/portfolio.png',
                      sizeBytes: 10240,
                      mimeType: 'image/png',
                      processingStatus: 'processed',
                    },
                  ]),
                }),
                orderBy: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue([
                    {
                      id: 1,
                      originalName: 'portfolio.png',
                      filepath: '/uploads/portfolio.png',
                      sizeBytes: 10240,
                      mimeType: 'image/png',
                      processingStatus: 'processed',
                    },
                  ]),
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
  });

  it('should route stock queries to StockTool', async () => {
    const decision = await router.routeAndExecute(
      'Tell me about Tata Steel price',
      'req-tool-1',
    );
    expect(decision.detectedIntent.intent).toBe('stock_lookup');
    expect(decision.toolExecuted).toBe('stock_fundamentals_lookup');
    expect(decision.contextString).toContain('GROUND TRUTH');
  });

  it('should route financial queries to FinancialTool', async () => {
    const decision = await router.routeAndExecute(
      'What is P/E ratio and ROE of RELIANCE?',
      'req-tool-2',
    );
    expect(decision.detectedIntent.intent).toBe('financial_ratios');
    expect(decision.toolExecuted).toBe('financial_ratios_lookup');
    expect(decision.contextString).toContain(
      'GROUND TRUTH LIVE FINANCIAL JSON FOR RELIANCE',
    );
  });

  it('should route screenshot prompts to VisionTool', async () => {
    const decision = await router.routeAndExecute(
      'Analyzing uploaded screenshot: portfolio.png',
      'req-tool-vis',
    );
    expect(decision.detectedIntent.intent).toBe('vision');
    expect(decision.toolExecuted).toBe('vision_ocr_extractor');
    expect(decision.contextString).toContain(
      'GROUND TRUTH VISION OCR EXTRACTED FROM UPLOADED SCREENSHOT',
    );
  });

  it('should handle general queries without crashing', async () => {
    const decision = await router.routeAndExecute(
      'What is the philosophy of investing?',
      'req-tool-3',
    );
    expect(decision.detectedIntent.intent).toBe('general');
    expect(decision.toolExecuted).toBeNull();
  });

  it('should handle greeting queries without triggering tools', async () => {
    const decision = await router.routeAndExecute(
      'Hello AI Mentor',
      'req-tool-4',
    );
    expect(decision.detectedIntent.intent).toBe('greeting');
    expect(decision.toolExecuted).toBeNull();
  });

  it('should route IPO list queries to IpoTool with PostgreSQL list data', async () => {
    const decision = await router.routeAndExecute(
      'tell me the current IPOs',
      'req-tool-ipo-list',
    );
    expect(decision.detectedIntent.intent).toBe('ipo_list');
    expect(decision.toolExecuted).toBe('ipo_prospectus_lookup');
    expect(decision.contextString).toContain(
      'GROUND TRUTH LIVE IPO LIST JSON FROM POSTGRESQL',
    );
    expect(decision.contextString).toContain('Dhoot Transmission');
    expect(decision.contextString).toContain('Swiggy');
    expect(decision.contextString).toContain('"gmp": null');
    // Compact list projection keeps the prompt small for reliable AI generation:
    // only the 12 list-relevant fields (listingDate is injected as null even
    // though the mock row does not include it), never the full 39-field rows.
    expect(decision.contextString).toContain('"listingDate": null');
    expect(decision.contextString).toContain('"totalSub"');
    expect(decision.contextString).not.toContain('"drhpLink"');
  });

  it('should route single IPO queries to IpoTool with PostgreSQL data', async () => {
    const decision = await router.routeAndExecute(
      'tell me about Dhoot Transmission IPO',
      'req-tool-ipo-single',
    );
    expect(decision.detectedIntent.intent).toBe('ipo_details');
    expect(decision.detectedIntent.targetCompany).toBe('Dhoot Transmission');
    expect(decision.toolExecuted).toBe('ipo_prospectus_lookup');
    expect(decision.contextString).toContain(
      'GROUND TRUTH IPO PROSPECTUS JSON FROM POSTGRESQL FOR Dhoot Transmission',
    );
    expect(decision.contextString).toContain('DHOOTTRANS');
    expect(decision.contextString).toContain('"gmp": null');
  });
});
