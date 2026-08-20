import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DRIZZLE_CONNECTION } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { companies, marketQuotes, providerCache } from '../../database/schema';
import { eq, and, gt } from 'drizzle-orm';
import { MarketMapper } from '../mappers/market.mapper';
import { TwelveDataProvider } from '../twelvedata.provider';
import { YahooFinanceProvider } from '../yahoo-finance.provider';
import { CompanyProfileDTO } from '../dto/company-profile.dto';
import { MarketQuoteDTO } from '../dto/market-quote.dto';
import { ProviderManager } from '../provider.manager';

@Injectable()
export class CompanySyncService {
  private readonly logger = new Logger(CompanySyncService.name);
  private readonly cacheTtlSeconds: number;

  constructor(
    @Inject(DRIZZLE_CONNECTION) private readonly db: DrizzleDB,
    private readonly twelveDataProvider: TwelveDataProvider,
    private readonly yahooFinanceProvider: YahooFinanceProvider,
    private readonly providerManager: ProviderManager,
    private readonly configService: ConfigService,
  ) {
    this.cacheTtlSeconds =
      this.configService.get<number>('provider.cacheTtlSeconds') || 3600;
  }

  async syncCompanyAndQuote(
    symbol: string,
  ): Promise<{ profile: CompanyProfileDTO; quote: MarketQuoteDTO }> {
    const sym = symbol.toUpperCase();
    const cacheKey = `company_quote_${sym}`;
    const now = new Date();

    // 1. Check PostgreSQL provider_cache table first
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
        this.logger.log(`[CompanySyncService] Cache HIT for ${sym}`);
        const parsed = JSON.parse(cached.payload);
        return {
          profile: parsed.profile,
          quote: parsed.quote,
        };
      }
    } catch (err) {
      // Cache lookup error non-blocking
    }

    this.logger.log(
      `[CompanySyncService] Cache MISS for ${sym}. Fetching from YahooFinance (primary) → TwelveData (fallback).`,
    );

    // 2. Fetch live data: YahooFinance primary → TwelveData fallback
    const quoteData = await this.providerManager.executeRequest(
      'YahooFinance',
      `/chart/${sym}.NS`,
      async () => {
        const rawQuote = await this.yahooFinanceProvider.getCurrentQuote(sym);
        const rawProfile =
          await this.yahooFinanceProvider.getCompanyProfile(sym);

        if (!rawQuote || rawQuote.currentPrice === 0) {
          throw new Error(`YahooFinance returned empty/zero data for ${sym}`);
        }

        const quoteDTO = MarketMapper.toQuoteDTO(rawQuote || {}, sym);
        const profileDTO = MarketMapper.toProfileDTO(rawProfile || {}, sym);

        // Enrich profile with 52-week data from Yahoo chart metadata
        if (rawQuote) {
          const meta = rawQuote as any;
          if (meta.fiftyTwoWeekHigh) profileDTO.high52 = meta.fiftyTwoWeekHigh;
          if (meta.fiftyTwoWeekLow) profileDTO.low52 = meta.fiftyTwoWeekLow;
        }

        return { profile: profileDTO, quote: quoteDTO };
      },
      async () => {
        // TwelveData fallback (may also fail on free tier for Indian stocks)
        try {
          const rawQuote = await this.twelveDataProvider.getCurrentQuote(sym);
          const rawProfile =
            await this.twelveDataProvider.getCompanyProfile(sym);
          const quoteDTO = MarketMapper.toQuoteDTO(rawQuote || {}, sym);
          const profileDTO = MarketMapper.toProfileDTO(rawProfile || {}, sym);
          return { profile: profileDTO, quote: quoteDTO };
        } catch (fallbackErr) {
          // Final fallback: return empty DTOs with symbol preserved
          const quoteDTO = MarketMapper.toQuoteDTO({}, sym);
          const profileDTO = MarketMapper.toProfileDTO({}, sym);
          return { profile: profileDTO, quote: quoteDTO };
        }
      },
    );

    // 3. Save to PostgreSQL provider_cache and database tables
    try {
      const expiresAt = new Date(Date.now() + this.cacheTtlSeconds * 1000);

      await this.db
        .insert(providerCache)
        .values({
          cacheKey,
          providerSource: 'YahooFinance',
          payload: JSON.stringify(quoteData),
          fetchedAt: now,
          expiresAt,
          status: 'valid',
        })
        .onConflictDoUpdate({
          target: providerCache.cacheKey,
          set: {
            providerSource: 'YahooFinance',
            payload: JSON.stringify(quoteData),
            fetchedAt: now,
            expiresAt,
            status: 'valid',
          },
        });

      await this.db
        .insert(companies)
        .values({
          symbol: quoteData.profile.symbol,
          companyName: quoteData.profile.companyName,
          exchange: quoteData.profile.exchange,
          sector: quoteData.profile.sector,
          industry: quoteData.profile.industry,
          marketCapCr: String(quoteData.profile.marketCapCr),
          high52: String(quoteData.profile.high52),
          low52: String(quoteData.profile.low52),
          volume: quoteData.profile.volume,
          description: quoteData.profile.description,
        })
        .onConflictDoNothing();

      await this.db
        .insert(marketQuotes)
        .values({
          symbol: quoteData.quote.symbol,
          currentPrice: String(quoteData.quote.currentPrice),
          open: String(quoteData.quote.open),
          high: String(quoteData.quote.high),
          low: String(quoteData.quote.low),
          close: String(quoteData.quote.close),
          volume: quoteData.quote.volume,
          change: String(quoteData.quote.change),
          changePercent: String(quoteData.quote.changePercent),
          timestamp: new Date(),
        })
        .onConflictDoNothing();
    } catch (err) {
      // Non-blocking save catch
    }

    return quoteData;
  }
}
