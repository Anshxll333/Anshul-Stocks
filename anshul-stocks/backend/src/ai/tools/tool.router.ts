import { Injectable, Logger } from '@nestjs/common';
import { IntentDetector, IntentResult } from './intent-detector';
import { StockTool } from './stock.tool';
import { FinancialTool } from './financial.tool';
import { IpoTool } from './ipo.tool';
import { VisionTool } from './vision.tool';
import { NewsTool } from './news.tool';
import { CalculatorTool } from './calculator.tool';
import { ToolResult } from './tool.interface';
import { ScoreEngine } from '../services/score.engine';
import { AppLogger } from '../../utils/logger';

export interface ToolRoutingDecision {
  detectedIntent: IntentResult;
  toolExecuted: string | null;
  result: ToolResult<any> | null;
  contextString?: string;
  structuredJsonPayload?: any;
  executionTimeMs: number;
  providerUsed?: string;
  contextJsonSize: number;
}

@Injectable()
export class ToolRouter {
  private readonly logger = new Logger(ToolRouter.name);
  // Simple in-memory cache for stock data (TTL: 60 seconds)
  private readonly stockCache = new Map<
    string,
    { data: any; timestamp: number }
  >();
  private readonly CACHE_TTL_MS = 60000;

  constructor(
    private readonly intentDetector: IntentDetector,
    private readonly stockTool: StockTool,
    private readonly financialTool: FinancialTool,
    private readonly ipoTool: IpoTool,
    private readonly visionTool: VisionTool,
    private readonly newsTool: NewsTool,
    private readonly calculatorTool: CalculatorTool,
    private readonly scoreEngine: ScoreEngine,
    private readonly appLogger: AppLogger,
  ) {}

  private getCachedStockData(symbol: string): any | null {
    const cached = this.stockCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      this.logger.log(`[ToolRouter] Cache hit for ${symbol}`);
      return cached.data;
    }
    return null;
  }

  private setCachedStockData(symbol: string, data: any): void {
    this.stockCache.set(symbol, { data, timestamp: Date.now() });
    // Cleanup old entries periodically
    if (this.stockCache.size > 100) {
      const now = Date.now();
      for (const [key, value] of this.stockCache.entries()) {
        if (now - value.timestamp > this.CACHE_TTL_MS) {
          this.stockCache.delete(key);
        }
      }
    }
  }

  async routeAndExecute(
    userMessage: string,
    requestIdArg?: string,
    conversationIdArg?: number | null,
  ): Promise<ToolRoutingDecision> {
    const startTime = Date.now();
    const requestId =
      requestIdArg || `req-${Math.random().toString(36).substring(2, 9)}`;
    const conversationId = conversationIdArg ?? null;

    const detection = this.intentDetector.detect(userMessage);

    // IPO-company rescue: prompts like "Analyze Dhoot Transmission" (no literal
    // "IPO" keyword) are detected as stock_lookup / general, so the AI receives
    // no ground-truth IPO JSON and emits a misleading "0 / 10" card with no risk
    // profile. If the prompt mentions a CURRENT live/upcoming IPO by name,
    // route it to the IPO prospectus tool (live PostgreSQL data, no hardcoding).
    let effectiveIntent: string = detection.intent;
    let effectiveTargetCompany: string | undefined = detection.targetCompany;
    if (
      (effectiveIntent === 'stock_lookup' || effectiveIntent === 'general') &&
      !/ipo|drhp|prospectus|gmp|subscription/i.test(userMessage)
    ) {
      const currentIpo = await this.ipoTool.matchCurrentIpo(userMessage);
      if (currentIpo) {
        effectiveIntent = 'ipo_details';
        effectiveTargetCompany = currentIpo;
        this.logger.log(
          `[ToolRouter] Re-routed "${detection.intent}" -> ipo_details for current IPO "${currentIpo}"`,
        );
      }
    }

    this.appLogger.logStageTimeline(
      requestId,
      conversationId,
      'INTENT_DETECTION',
      'COMPLETED',
      Date.now() - startTime,
      `Detected intent: "${detection.intent}" with confidence: ${detection.confidence}`,
      {
        intent: detection.intent,
        confidence: detection.confidence,
        targetSymbol: detection.targetSymbol,
      },
    );

    let selectedToolName: string | null = null;
    let toolResult: ToolResult<any> | null = null;
    let contextString: string | undefined = undefined;
    let structuredJsonPayload: any = undefined;
    let providerUsed = 'InternalEngine';

    try {
      switch (effectiveIntent) {
        case 'greeting': {
          selectedToolName = null;
          contextString =
            '[GREETING INTENT] Conversational greeting requested.';
          providerUsed = 'ConversationalEngine';
          break;
        }

        case 'financial_ratios':
        case 'stock_lookup': {
          selectedToolName =
            detection.intent === 'financial_ratios'
              ? this.financialTool.metadata.name
              : this.stockTool.metadata.name;
          const symbol =
            detection.targetSymbol ||
            userMessage.trim().split(/\s+/).pop()?.toUpperCase() ||
            '';
          if (!symbol) break;

          // Check cache first for stock data
          const cachedData = this.getCachedStockData(symbol);
          let stockRes, financialRes, newsRes;

          if (cachedData) {
            // Use cached stock data, only fetch financial and news
            stockRes = { data: cachedData };
            [financialRes, newsRes] = await Promise.all([
              this.financialTool.execute({ symbol }),
              this.newsTool.execute({ topic: symbol }),
            ]);
          } else {
            // Fetch all data in parallel
            [stockRes, financialRes, newsRes] = await Promise.all([
              this.stockTool.execute({ symbol }),
              this.financialTool.execute({ symbol }),
              this.newsTool.execute({ topic: symbol }),
            ]);
            // Cache the stock data for future requests
            if (stockRes.data) {
              this.setCachedStockData(symbol, stockRes.data);
            }
          }

          const profileData = stockRes.data || {};
          const quoteData = stockRes.data || {};
          const finData = financialRes.data || {};

          // Merge profileData and finData into a single unified financial object
          const mergedFinancials = {
            ...profileData,
            ...finData,
            revenueGrowthPercent:
              finData.revenueGrowthPercent ??
              profileData.revenueGrowthPercent ??
              profileData.revenueGrowth ??
              null,
            profitGrowthPercent:
              finData.profitGrowthPercent ??
              profileData.profitGrowthPercent ??
              profileData.earningsGrowth ??
              null,
            roe: finData.roe ?? profileData.roe ?? null,
            roce: finData.roce ?? profileData.roce ?? profileData.roa ?? null,
            debtToEquity:
              finData.debtToEquity ?? profileData.debtToEquity ?? null,
            peRatio: finData.peRatio ?? profileData.peRatio ?? null,
            pbRatio: finData.pbRatio ?? profileData.pbRatio ?? null,
            operatingMargin:
              finData.operatingMargin ?? profileData.operatingMargin ?? null,
            netMargin: finData.netMargin ?? profileData.netMargin ?? null,
            revenueCr: finData.revenueCr ?? profileData.revenueCr ?? null,
            netProfitCr: finData.netProfitCr ?? profileData.netProfitCr ?? null,
            eps: finData.eps ?? profileData.eps ?? null,
            dividendYield:
              finData.dividendYield ?? profileData.dividendYield ?? null,
            marketCapCr:
              profileData.marketCapCr ??
              (profileData.marketCap
                ? Math.round(profileData.marketCap / 10000000)
                : null),
          };

          const scoreReport = this.scoreEngine.calculateScore(
            profileData,
            quoteData,
            mergedFinancials,
          );

          structuredJsonPayload = {
            symbol: profileData.symbol || symbol,
            companyName: profileData.companyName || profileData.name || symbol,
            exchange: profileData.exchange || 'NSE',
            sector: profileData.sector || 'N/A',
            industry: profileData.industry || 'N/A',
            currentPrice:
              quoteData.currentPrice ?? profileData.currentPrice ?? null,
            open: quoteData.open ?? null,
            high: quoteData.high ?? null,
            low: quoteData.low ?? null,
            high52w:
              profileData.fiftyTwoWeekHigh ?? profileData.high52w ?? null,
            low52w: profileData.fiftyTwoWeekLow ?? profileData.low52w ?? null,
            volume: quoteData.volume ?? null,
            changePercent:
              quoteData.percentChange ?? quoteData.changePercent ?? null,
            marketCapCr: mergedFinancials.marketCapCr,
            peRatio: mergedFinancials.peRatio,
            pbRatio: mergedFinancials.pbRatio,
            debtToEquity: mergedFinancials.debtToEquity,
            operatingMargin: mergedFinancials.operatingMargin,
            netMargin: mergedFinancials.netMargin,
            roe: mergedFinancials.roe,
            roce: mergedFinancials.roce,
            revenueGrowthPercent: mergedFinancials.revenueGrowthPercent,
            profitGrowthPercent: mergedFinancials.profitGrowthPercent,
            revenueCr: mergedFinancials.revenueCr,
            netProfitCr: mergedFinancials.netProfitCr,
            eps: mergedFinancials.eps,
            dividendYield: mergedFinancials.dividendYield,
            calculatedScore: scoreReport,
            recentNews: newsRes.data || [],
            lastUpdated: new Date().toISOString(),
          };

          const hasValidPriceOrProfile = !!(
            quoteData.currentPrice ||
            profileData.name ||
            profileData.companyName
          );

          if (!hasValidPriceOrProfile) {
            contextString = `[LIVE DATA UNAVAILABLE]: Live exchange metrics are currently unavailable for '${symbol}'. Please ask the user to verify the exact stock ticker (e.g. BANKBARODA for Bank of Baroda, RELIANCE, TCS). Do NOT output a stock decision card JSON. Respond politely in text.`;
          } else {
            contextString = `[GROUND TRUTH LIVE FINANCIAL JSON FOR ${symbol}]:\n${JSON.stringify(structuredJsonPayload, null, 2)}`;
          }
          providerUsed = 'YahooFinance / LiveProviderPipeline';
          break;
        }

        case 'ipo_details':
        case 'ipo_list': {
          selectedToolName = this.ipoTool.metadata.name;
          const listQuery = effectiveIntent === 'ipo_list';
          let companyName = listQuery
            ? undefined
            : effectiveTargetCompany || undefined;
          // Rescue garbled company extraction from the intent detector (e.g.
          // "its grey market premium total" instead of "Dhoot Transmission"):
          // when the detected target contains IPO-filler words, re-resolve the
          // canonical current-IPO name from the prompt against PostgreSQL so the
          // AI always receives the same real DB row for the same IPO.
          if (!listQuery && companyName) {
            // ALWAYS try to match the canonical current-IPO name from the raw prompt first,
            // because the intent-detector's extraction is heuristic and often leaves verbs
            // like "Analyze" or "evaluate" attached to the company name, causing cache misses.
            const canonical = await this.ipoTool.matchCurrentIpo(userMessage);
            if (canonical) {
              this.logger.log(
                `[ToolRouter] ipo_details resolved canonical name: "${companyName}" -> "${canonical}"`,
              );
              companyName = canonical;
            } else {
              const suspicious =
                /\b(grey|market|premium|total|multiple|its|gmp|subscription|status|price|band|lot|detail|review|analysis|should|apply|invest|buy|overall|current|live|upcoming|open|available|number)\b/i.test(
                  companyName,
                );
              if (suspicious) {
                this.logger.warn(`[ToolRouter] ipo_details company name "${companyName}" is suspicious but no canonical match was found.`);
              }
            }
          }
          toolResult = await this.ipoTool.execute({
            companyName,
            listQuery,
          });
          structuredJsonPayload = toolResult.data;

          const data: any = toolResult.data || {};
          if (listQuery || data.type === 'list') {
            const items: any[] = data.items || [];
            if (items.length === 0) {
              contextString = `[GROUND TRUTH LIVE IPO LIST JSON FROM POSTGRESQL]:\n[]\nThe user asked about the current/live/upcoming IPOs. There are currently no open or upcoming IPOs synchronized in the PostgreSQL ipo_data table. State this clearly and do NOT invent any IPO.`;
            } else {
              // Compact list projection keeps the prompt small enough for reliable
              // AI generation (full 39-field rows x 69 IPOs would exceed the model
              // context budget and trigger the resilient fallback response).
              const compactItems = items.map((ipo: any) => ({
                companyName: ipo.companyName ?? null,
                symbol: ipo.symbol ?? null,
                status: ipo.status ?? null,
                priceRange: ipo.priceRange ?? ipo.priceBand ?? null,
                lotSize: ipo.lotSize ?? null,
                issueSizeCr: ipo.issueSizeCr ?? null,
                openDate: ipo.openDate ?? null,
                closeDate: ipo.closeDate ?? null,
                listingDate: ipo.listingDate ?? null,
                gmp: ipo.gmp ?? null,
                gmpGainPercent: ipo.gmpGainPercent ?? null,
                totalSub: ipo.totalSub ?? null,
              }));
              contextString = `[GROUND TRUTH LIVE IPO LIST JSON FROM POSTGRESQL]:\n${JSON.stringify(compactItems, null, 2)}`;
            }
          } else {
            const ipo: any = data.ipo || {};
            const companyLabel = ipo.companyName || companyName || 'IPO';
            contextString = `[GROUND TRUTH IPO PROSPECTUS JSON FROM POSTGRESQL FOR ${companyLabel}]:\n${JSON.stringify(ipo, null, 2)}\nUse ONLY the fields in this JSON (priceRange, lotSize, gmp, gmpGainPercent, totalSub, dates, issueSizeCr, status, etc.). If any metric is missing (null) — e.g. GMP or subscription — report it as "Not available". NEVER invent numbers.`;
          }
          providerUsed = 'PostgreSQL/IpoProvider';
          break;
        }

        case 'news': {
          selectedToolName = this.newsTool.metadata.name;
          const symbol = detection.targetSymbol || 'MARKET';
          toolResult = await this.newsTool.execute({ topic: symbol });
          structuredJsonPayload = toolResult.data;
          contextString = `[GROUND TRUTH FINANCIAL NEWS HEADLINES JSON FOR ${symbol}]:\n${JSON.stringify(toolResult.data, null, 2)}`;
          providerUsed = 'NewsProvider';
          break;
        }

        case 'calculator': {
          selectedToolName = this.calculatorTool.metadata.name;
          const text = userMessage.toLowerCase();
          let op: any = 'cagr';
          if (text.includes('return')) op = 'return';
          if (text.includes('position')) op = 'position_size';
          if (text.includes('risk reward')) op = 'risk_reward';
          if (text.includes('pe')) op = 'pe_ratio';

          toolResult = await this.calculatorTool.execute({ operation: op });
          structuredJsonPayload = toolResult.data;
          contextString = `[GROUND TRUTH FINANCIAL CALCULATOR RESULT JSON]:\n${JSON.stringify(toolResult.data, null, 2)}`;
          providerUsed = 'CalculatorEngine';
          break;
        }

        case 'vision': {
          selectedToolName = this.visionTool.metadata.name;
          const uploadId = detection.uploadId || 'latest';
          toolResult = await this.visionTool.execute({
            uploadId,
            conversationId: conversationId ?? undefined,
          });
          structuredJsonPayload = toolResult.data;
          contextString = toolResult.success
            ? `[GROUND TRUTH VISION OCR EXTRACTED FROM UPLOADED SCREENSHOT]:\n${toolResult.data.ocrExtractedText}`
            : `[VISION ERROR]: ${toolResult.data.error}`;
          providerUsed = 'VisionOcrEngine';
          break;
        }

        case 'general': {
          selectedToolName = null;
          contextString =
            '[GENERAL INTENT] No specific financial tool required. Provide a helpful conversational response.';
          providerUsed = 'ConversationalEngine';
          break;
        }

        default: {
          break;
        }
      }
    } catch (err: any) {
      this.logger.error(
        `[ToolRouter Fail] Execution of tool ${selectedToolName} failed: ${err.message}`,
        err.stack,
      );
      this.appLogger.logStageTimeline(
        requestId,
        conversationId,
        'TOOL_ROUTING',
        'FAILED',
        Date.now() - startTime,
        `Tool ${selectedToolName} failed (${err.message}). Continuing chat without ground truth context.`,
        { error: err.message },
      );
      toolResult = null;
      contextString = undefined;
      structuredJsonPayload = undefined;
    }

    const executionTimeMs = Date.now() - startTime;
    const contextJsonSize = contextString
      ? Buffer.byteLength(contextString, 'utf8')
      : 0;

    this.appLogger.logStageTimeline(
      requestId,
      conversationId,
      'TOOL_ROUTING',
      toolResult || detection.intent === 'greeting' ? 'COMPLETED' : 'SKIPPED',
      executionTimeMs,
      selectedToolName
        ? `Executed tool: ${selectedToolName}`
        : `Intent processed: ${detection.intent}`,
      {
        detectedIntent: detection.intent,
        confidence: detection.confidence,
        selectedTool: selectedToolName,
        executionTimeMs,
        contextJsonSize,
        providerUsed,
        returnedDto: structuredJsonPayload ? 'DTO Available' : 'None',
      },
    );

    return {
      detectedIntent: detection,
      toolExecuted: selectedToolName,
      result: toolResult,
      contextString,
      structuredJsonPayload,
      executionTimeMs,
      providerUsed,
      contextJsonSize,
    };
  }
}
