import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DRIZZLE_CONNECTION } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { financialMetrics, providerCache } from '../../database/schema';
import { eq, and, gt } from 'drizzle-orm';
import { FinancialProvider } from '../financial.provider';
import { FinancialMetricDTO } from '../dto/financial-metric.dto';
import { ProviderManager } from '../provider.manager';
import { YahooFinanceProvider } from '../yahoo-finance.provider';
import { FinancialMapper } from '../mappers/financial.mapper';

@Injectable()
export class FinancialSyncService {
  private readonly logger = new Logger(FinancialSyncService.name);
  private readonly cacheTtlSeconds: number;

  constructor(
    @Inject(DRIZZLE_CONNECTION) private readonly db: DrizzleDB,
    private readonly financialProvider: FinancialProvider,
    private readonly yahooFinanceProvider: YahooFinanceProvider,
    private readonly providerManager: ProviderManager,
    private readonly configService: ConfigService,
  ) {
    this.cacheTtlSeconds =
      this.configService.get<number>('provider.cacheTtlSeconds') || 3600;
  }

  async syncFinancials(symbol: string): Promise<FinancialMetricDTO> {
    const sym = symbol.toUpperCase();
    const cacheKey = `financials_${sym}`;
    const now = new Date();

    // 1. Check PostgreSQL cache first
    try {
      const [cached] = await this.db
        .select()
        .from(providerCache)
        .where(
          and(
            eq(providerCache.cacheKey, cacheKey),
            gt(providerCache.expiresAt, now),
          ),
        );

      if (cached && cached.payload) {
        this.logger.log(
          `[FinancialSyncService] Cache HIT for financials ${sym}`,
        );
        return JSON.parse(cached.payload);
      }
    } catch (err) {
      // Non-blocking catch
    }

    this.logger.log(
      `[FinancialSyncService] Cache MISS for financials ${sym}. Fetching from YahooFinance (primary) → TwelveData (fallback).`,
    );

    // 2. Fetch live data through ProviderManager with fallback
    const metrics = await this.providerManager.executeRequest(
      'YahooFinance-Financials',
      `/quoteSummary/${sym}`,
      async () => {
        const profile = await this.yahooFinanceProvider.getCompanyProfile(sym);
        if (!profile) throw new Error(`No YahooFinance profile for ${sym}`);
        return FinancialMapper.toMetricDTO(profile, sym);
      },
      async () => {
        try {
          return await this.financialProvider.getFinancialMetrics(sym);
        } catch {
          return FinancialMapper.toMetricDTO({}, sym);
        }
      },
    );

    // 3. Save to PostgreSQL cache and database tables
    try {
      const expiresAt = new Date(Date.now() + this.cacheTtlSeconds * 1000);

      await this.db
        .insert(providerCache)
        .values({
          cacheKey,
          providerSource: 'TwelveData-Financials',
          payload: JSON.stringify(metrics),
          fetchedAt: now,
          expiresAt,
          status: 'valid',
        })
        .onConflictDoNothing();

      await this.db
        .insert(financialMetrics)
        .values({
          symbol: metrics.symbol,
          revenueCr: String(metrics.revenueCr),
          netProfitCr: String(metrics.netProfitCr),
          eps: String(metrics.eps),
          bookValue: String(metrics.bookValue),
          peRatio: String(metrics.peRatio),
          pbRatio: String(metrics.pbRatio),
          roe: String(metrics.roe),
          roce: String(metrics.roce),
          debtToEquity: String(metrics.debtToEquity),
          currentRatio: String(metrics.currentRatio),
          operatingMargin: String(metrics.operatingMargin),
          netMargin: String(metrics.netMargin),
          freeCashFlowCr: String(metrics.freeCashFlowCr),
          enterpriseValueCr: String(metrics.enterpriseValueCr),
          dividendYield: String(metrics.dividendYield),
          updatedAt: new Date(),
        })
        .onConflictDoNothing();
    } catch (err) {
      // Non-blocking catch
    }

    return metrics;
  }
}
