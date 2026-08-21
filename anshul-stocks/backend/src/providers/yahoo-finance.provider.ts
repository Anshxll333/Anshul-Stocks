import { Injectable, Logger } from '@nestjs/common';
import {
  IMarketProvider,
  MarketCompanyProfile,
  MarketPriceQuote,
  MarketOhlcData,
  MarketState,
} from './provider.interface';
import { fetchWithTimeout } from '../utils/fetch-timeout';

/**
 * YahooFinanceProvider — Free, real-time Indian stock data via Yahoo Finance v8 Chart API.
 *
 * TwelveData free tier does NOT support Indian exchanges (NSE/BSE).
 * Yahoo Finance provides real-time quotes, profile data, and OHLC for NSE-listed Indian equities
 * using the `.NS` suffix (e.g. RELIANCE.NS, MRF.NS, TCS.NS).
 */
@Injectable()
export class YahooFinanceProvider implements IMarketProvider {
  private readonly logger = new Logger(YahooFinanceProvider.name);
  private readonly baseUrl = 'https://query1.finance.yahoo.com';
  private readonly userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  private sessionCookie: string | null = null;
  private sessionCrumb: string | null = null;
  private sessionFetchedAt = 0;

  private readonly chartCache = new Map<
    string,
    { data: any; expiresAt: number }
  >();
  private readonly summaryCache = new Map<
    string,
    { data: any; expiresAt: number }
  >();

  getProviderName(): string {
    return 'Yahoo Finance (India NSE)';
  }

  private async getCrumbAndCookie(): Promise<{
    cookie: string;
    crumb: string;
  }> {
    const now = Date.now();
    if (
      this.sessionCookie &&
      this.sessionCrumb &&
      now - this.sessionFetchedAt < 1800000
    ) {
      return { cookie: this.sessionCookie, crumb: this.sessionCrumb };
    }

    try {
      const res1 = await fetchWithTimeout(
        'https://fc.yahoo.com',
        { headers: { 'User-Agent': this.userAgent } },
        5000,
      );
      const cookie = res1.headers.get('set-cookie') || '';
      const res2 = await fetchWithTimeout(
        'https://query1.finance.yahoo.com/v1/test/getcrumb',
        {
          headers: { 'User-Agent': this.userAgent, Cookie: cookie },
        },
        5000,
      );
      if (res2.ok) {
        const crumb = await res2.text();
        this.sessionCookie = cookie;
        this.sessionCrumb = crumb;
        this.sessionFetchedAt = now;
        return { cookie, crumb };
      }
    } catch (err: any) {
      this.logger.warn(
        `[YahooFinance] Failed to fetch session crumb: ${err.message}`,
      );
    }
    return { cookie: '', crumb: '' };
  }

  private formatSymbol(symbol: string): string {
    let clean = symbol.trim().toUpperCase();
    if (
      clean.includes('BARODA') ||
      clean.includes('BANKOFBARODA') ||
      clean.includes('BANK OF BARODA')
    )
      return 'BANKBARODA.NS';
    if (clean.includes('COPPER') || clean.includes('HINDUSTANCOPPER'))
      return 'HINDCOPPER.NS';
    if (clean.includes('TATASTEEL') || clean.includes('TATA STEEL'))
      return 'TATASTEEL.NS';
    if (clean.includes('COALINDIA') || clean.includes('COAL INDIA'))
      return 'COALINDIA.NS';

    clean = clean.replace(/\s+/g, '');
    clean = clean.replace(/\.NSE$/i, '.NS').replace(/\.BSE$/i, '.BO');
    if (clean === 'ZOMATO' || clean === 'ZOMATO.NS') return 'ETERNAL.NS';
    if (clean === 'TATAMOTORS' || clean === 'TATAMOTORS.NS') return 'TMCV.NS';
    if (clean === 'SBIFUNDS' || clean === 'SBIFUND') return 'SBINEQWETF.BO';
    if (clean === 'NIFTY' || clean === 'NIFTY50') return '^NSEI';
    if (clean === 'SENSEX') return '^BSESN';
    if (clean.includes('.')) return clean;
    return `${clean}.NS`;
  }

  private async fetchChartData(
    symbol: string,
    range: string = '5d',
    interval: string = '1d',
  ): Promise<any> {
    const formatted = this.formatSymbol(symbol);
    const cacheKey = `${formatted}_${range}_${interval}`;
    const now = Date.now();
    const cached = this.chartCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const url = `${this.baseUrl}/v8/finance/chart/${formatted}?interval=${interval}&range=${range}`;

    const response = await fetchWithTimeout(
      url,
      {
        headers: { 'User-Agent': this.userAgent },
      },
      5000,
    );

    if (!response.ok) {
      throw new Error(`Yahoo Finance HTTP ${response.status} for ${formatted}`);
    }

    const data = await response.json();

    if (!data.chart?.result?.[0]) {
      throw new Error(`Yahoo Finance: No chart data for ${formatted}`);
    }

    this.chartCache.set(cacheKey, {
      data: data.chart.result[0],
      expiresAt: now + 30000,
    });
    return data.chart.result[0];
  }

  /**
   * Fetch enriched company data from Yahoo Finance v10 quoteSummary endpoint with session crumb.
   */
  async fetchQuoteSummary(symbol: string): Promise<any> {
    const formatted = this.formatSymbol(symbol);
    const now = Date.now();
    const cached = this.summaryCache.get(formatted);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const { cookie, crumb } = await this.getCrumbAndCookie();
    const crumbParam = crumb ? `&crumb=${encodeURIComponent(crumb)}` : '';
    const url = `${this.baseUrl}/v10/finance/quoteSummary/${formatted}?modules=assetProfile,financialData,defaultKeyStatistics,incomeStatementHistory,incomeStatementHistoryQuarterly,majorHoldersBreakdown,cashflowStatementHistory${crumbParam}`;

    const headers: Record<string, string> = { 'User-Agent': this.userAgent };
    if (cookie) headers['Cookie'] = cookie;

    const response = await fetchWithTimeout(url, { headers }, 5000);

    if (!response.ok) {
      // Clear session if unauthorized
      if (response.status === 401) {
        this.sessionCookie = null;
        this.sessionCrumb = null;
      }
      throw new Error(
        `Yahoo Finance QuoteSummary HTTP ${response.status} for ${formatted}`,
      );
    }

    const data = await response.json();

    if (!data.quoteSummary?.result?.[0]) {
      throw new Error(`Yahoo Finance: No quoteSummary data for ${formatted}`);
    }

    this.summaryCache.set(formatted, {
      data: data.quoteSummary.result[0],
      expiresAt: now + 30000,
    });
    return data.quoteSummary.result[0];
  }

  async getCompanyProfile(
    symbol: string,
  ): Promise<MarketCompanyProfile | null> {
    try {
      let activeSym = symbol;
      let chartResult: any = null;
      try {
        chartResult = await this.fetchChartData(activeSym);
      } catch (err1) {
        // Retry with search API lookup if direct symbol failed
        const searchRes = await this.searchCompanies(symbol);
        if (searchRes && searchRes.length > 0 && searchRes[0].symbol) {
          activeSym = searchRes[0].symbol;
          this.logger.log(
            `[YahooFinance] Resolved '${symbol}' -> '${activeSym}' via Search API`,
          );
          chartResult = await this.fetchChartData(activeSym);
        } else {
          throw err1;
        }
      }
      const meta = chartResult.meta || {};

      let assetProfile: any = {};
      let financialData: any = {};
      let keyStats: any = {};
      let holders: any = {};
      let quarterly: any = [];
      let summaryDetail: any = {};
      try {
        const summary = await this.fetchQuoteSummary(symbol);
        assetProfile = summary.assetProfile || {};
        financialData = summary.financialData || {};
        keyStats = summary.defaultKeyStatistics || {};
        holders = summary.majorHoldersBreakdown || {};
        quarterly =
          summary.incomeStatementHistoryQuarterly?.incomeStatementHistory || [];
        summaryDetail = summary.summaryDetail || {};
      } catch (summaryErr: any) {
        this.logger.warn(
          `[YahooFinance] QuoteSummary enrichment failed for ${symbol}: ${summaryErr.message}. Falling back to chart meta only.`,
        );
      }

      const marketCapRaw =
        financialData.marketCap?.raw ??
        meta.marketCap ??
        keyStats.marketCap?.raw ??
        undefined;

      const fiftyTwoWeekHigh =
        financialData.fiftyTwoWeekHigh?.raw ??
        meta.fiftyTwoWeekHigh ??
        keyStats.fiftyTwoWeekHigh?.raw ??
        undefined;

      const fiftyTwoWeekLow =
        financialData.fiftyTwoWeekLow?.raw ??
        meta.fiftyTwoWeekLow ??
        keyStats.fiftyTwoWeekLow?.raw ??
        undefined;

      const parseVal = (obj: any): number | undefined =>
        obj && typeof obj.raw === 'number' ? obj.raw : undefined;
      const toPct = (val: number | undefined): number | undefined =>
        val !== undefined
          ? Math.abs(val) <= 5
            ? Math.round(val * 10000) / 100
            : Math.round(val * 100) / 100
          : undefined;
      const toCr = (val: number | undefined): number | undefined =>
        val !== undefined ? Math.round(val / 10000000) : undefined;

      const promoterPct = parseVal(holders.insidersPercentHeld)
        ? Math.round(parseVal(holders.insidersPercentHeld)! * 10000) / 100
        : undefined;
      const instPct = parseVal(holders.institutionsPercentHeld)
        ? Math.round(parseVal(holders.institutionsPercentHeld)! * 10000) / 100
        : undefined;
      const publicPct =
        promoterPct !== undefined && instPct !== undefined
          ? Math.max(0, Math.round((100 - promoterPct - instPct) * 100) / 100)
          : undefined;

      const quarterlyResults = quarterly.map((q: any) => ({
        periodEnd: q.endDate?.fmt || 'Quarter',
        revenueCr: parseVal(q.totalRevenue)
          ? Math.round(parseVal(q.totalRevenue)! / 10000000)
          : undefined,
        netProfitCr: parseVal(q.netIncome)
          ? Math.round(parseVal(q.netIncome)! / 10000000)
          : undefined,
      }));

      const rawDebtEq = parseVal(financialData.debtToEquity);
      const debtEqRatio =
        rawDebtEq !== undefined
          ? rawDebtEq > 5
            ? Math.round((rawDebtEq / 100) * 100) / 100
            : Math.round(rawDebtEq * 100) / 100
          : undefined;

      return {
        symbol: symbol.toUpperCase(),
        name:
          meta.longName ||
          meta.shortName ||
          assetProfile.longBusinessSummary?.slice(0, 80) ||
          symbol.toUpperCase(),
        exchange: meta.fullExchangeName || meta.exchangeName || 'NSE',
        currency: meta.currency || 'INR',
        country: 'India',
        sector: assetProfile.sector || '',
        industry: assetProfile.industry || '',
        description: assetProfile.longBusinessSummary || '',
        website: assetProfile.website || '',
        isin: '',
        marketCap: marketCapRaw ? Number(marketCapRaw) : undefined,
        fiftyTwoWeekHigh: fiftyTwoWeekHigh
          ? Number(fiftyTwoWeekHigh)
          : undefined,
        fiftyTwoWeekLow: fiftyTwoWeekLow ? Number(fiftyTwoWeekLow) : undefined,
        enterpriseValueCr: toCr(parseVal(keyStats.enterpriseValue)),
        beta: parseVal(keyStats.beta),
        shareholding:
          promoterPct !== undefined
            ? {
                promoterHoldingPercent: promoterPct,
                fiiHoldingPercent: instPct,
                publicHoldingPercent: publicPct,
              }
            : undefined,
        quarterlyResults:
          quarterlyResults.length > 0 ? quarterlyResults : undefined,
        analystConsensus: financialData.recommendationKey || undefined,
        targetPriceMean: parseVal(financialData.targetMeanPrice),
        revenueCr: toCr(parseVal(financialData.totalRevenue)),
        netProfitCr: toCr(parseVal(financialData.netIncomeToCommon)),
        eps: parseVal(keyStats.trailingEps),
        bookValue: parseVal(keyStats.bookValue),
        peRatio: parseVal(keyStats.trailingPE ?? summaryDetail.trailingPE),
        forwardPe: parseVal(keyStats.forwardPE ?? summaryDetail.forwardPE),
        pegRatio: parseVal(keyStats.pegRatio),
        pbRatio: parseVal(keyStats.priceToBook ?? summaryDetail.priceToBook),
        roe: toPct(parseVal(financialData.returnOnEquity)),
        roce: toPct(parseVal(financialData.returnOnAssets)),
        roa: toPct(parseVal(financialData.returnOnAssets)),
        debtToEquity: debtEqRatio,
        currentRatio: parseVal(financialData.currentRatio),
        quickRatio: parseVal(financialData.quickRatio),
        operatingMargin: toPct(parseVal(financialData.operatingMargins)),
        netMargin: toPct(parseVal(financialData.profitMargins)),
        freeCashFlowCr: toCr(parseVal(financialData.freeCashflow)),
        operatingCashFlowCr: toCr(parseVal(financialData.operatingCashflow)),
        totalDebtCr: toCr(parseVal(financialData.totalDebt)),
        totalCashCr: toCr(parseVal(financialData.totalCash)),
        ebitdaCr: toCr(parseVal(financialData.ebitda)),
        revenueGrowthPercent: toPct(parseVal(financialData.revenueGrowth)),
        profitGrowthPercent: toPct(parseVal(financialData.earningsGrowth)),
        dividendYield: toPct(
          parseVal(keyStats.dividendYield ?? summaryDetail.dividendYield),
        ),
      } as any;
    } catch (err: any) {
      this.logger.error(
        `[YahooFinance] Profile fetch failed for ${symbol}: ${err.message}`,
      );
      return null;
    }
  }

  async getCurrentQuote(symbol: string): Promise<MarketPriceQuote | null> {
    try {
      const chartResult = await this.fetchChartData(symbol);
      const meta = chartResult.meta || {};

      const currentPrice = meta.regularMarketPrice ?? 0;
      const previousClose =
        meta.chartPreviousClose ?? meta.previousClose ?? currentPrice;
      const dayHigh = meta.regularMarketDayHigh ?? currentPrice;
      const dayLow = meta.regularMarketDayLow ?? currentPrice;
      const volume = meta.regularMarketVolume ?? 0;
      const change = currentPrice - previousClose;
      const percentChange =
        previousClose > 0 ? (change / previousClose) * 100 : 0;

      return {
        symbol: symbol.toUpperCase(),
        currentPrice,
        open: dayLow,
        high: dayHigh,
        low: dayLow,
        close: currentPrice,
        previousClose,
        change: Math.round(change * 100) / 100,
        percentChange: Math.round(percentChange * 100) / 100,
        volume,
        timestamp: new Date(meta.regularMarketTime * 1000),
      };
    } catch (err: any) {
      this.logger.error(
        `[YahooFinance] Quote fetch failed for ${symbol}: ${err.message}`,
      );
      return null;
    }
  }

  async getDailyOhlc(symbol: string): Promise<MarketOhlcData | null> {
    try {
      const chartResult = await this.fetchChartData(symbol);

      const timestamps = chartResult.timestamp || [];
      const indicators = chartResult.indicators?.quote?.[0] || {};

      if (timestamps.length === 0) return null;

      const lastIdx = timestamps.length - 1;

      return {
        symbol: symbol.toUpperCase(),
        open: indicators.open?.[lastIdx] ?? 0,
        high: indicators.high?.[lastIdx] ?? 0,
        low: indicators.low?.[lastIdx] ?? 0,
        close: indicators.close?.[lastIdx] ?? 0,
        volume: indicators.volume?.[lastIdx] ?? 0,
        date: new Date(timestamps[lastIdx] * 1000).toISOString().split('T')[0],
      };
    } catch (err: any) {
      this.logger.error(
        `[YahooFinance] OHLC fetch failed for ${symbol}: ${err.message}`,
      );
      return null;
    }
  }

  async getHistoricalOhlc(
    symbol: string,
    timeframe: string = '1Y',
  ): Promise<any[]> {
    try {
      let range = '1y';
      let interval = '1d';
      const tf = timeframe.toUpperCase();
      if (tf === '1D') {
        range = '1d';
        interval = '5m';
      } else if (tf === '1W') {
        range = '5d';
        interval = '15m';
      } else if (tf === '1M') {
        range = '1mo';
        interval = '1d';
      } else if (tf === '1Y') {
        range = '1y';
        interval = '1d';
      } else if (tf === '5Y') {
        range = '5y';
        interval = '1wk';
      }

      const chartResult = await this.fetchChartData(symbol, range, interval);
      const timestamps: number[] = chartResult.timestamp || [];
      const quote = chartResult.indicators?.quote?.[0] || {};

      const ohlcList: any[] = [];
      const seenTimes = new Set<string | number>();

      for (let i = 0; i < timestamps.length; i++) {
        if (quote.open?.[i] != null && quote.close?.[i] != null) {
          const ts = timestamps[i];
          const isIntraday = tf === '1D' || tf === '1W';
          const timeVal = isIntraday
            ? ts
            : new Date(ts * 1000).toISOString().split('T')[0];

          if (!seenTimes.has(timeVal)) {
            seenTimes.add(timeVal);
            ohlcList.push({
              time: timeVal,
              open: Number(quote.open[i].toFixed(2)),
              high: Number((quote.high?.[i] ?? quote.open[i]).toFixed(2)),
              low: Number((quote.low?.[i] ?? quote.open[i]).toFixed(2)),
              close: Number(quote.close[i].toFixed(2)),
              value: Number(quote.close[i].toFixed(2)),
              volume: quote.volume?.[i] ?? 0,
            });
          }
        }
      }
      return ohlcList;
    } catch (err: any) {
      this.logger.error(
        `[YahooFinance] Historical OHLC fetch failed for ${symbol} (${timeframe}): ${err.message}`,
      );
      return [];
    }
  }

  async getMarketStatus(exchange = 'NSE'): Promise<MarketState> {
    const now = new Date();
    const istHour = new Date(
      now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
    ).getHours();
    const istDay = new Date(
      now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
    ).getDay();
    const isWeekday = istDay >= 1 && istDay <= 5;
    const isMarketHours = istHour >= 9 && istHour < 16;

    return {
      exchange,
      isOpen: isWeekday && isMarketHours,
    };
  }

  async getBulkQuotes(
    symbols: string[],
  ): Promise<Map<string, MarketPriceQuote>> {
    const map = new Map<string, MarketPriceQuote>();
    for (const sym of symbols) {
      const quote = await this.getCurrentQuote(sym);
      if (quote) {
        map.set(sym.toUpperCase(), quote);
      }
    }
    return map;
  }

  async searchCompanies(query: string): Promise<MarketCompanyProfile[]> {
    try {
      const { cookie, crumb } = await this.getCrumbAndCookie();
      const crumbParam = crumb ? `&crumb=${encodeURIComponent(crumb)}` : '';
      const url = `${this.baseUrl}/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0${crumbParam}`;
      const headers: Record<string, string> = { 'User-Agent': this.userAgent };
      if (cookie) headers['Cookie'] = cookie;

      const response = await fetchWithTimeout(url, { headers }, 5000);

      if (!response.ok) return [];

      const data = await response.json();
      const quotes = data.quotes || [];

      return quotes
        .filter(
          (q: any) =>
            q.exchange === 'NSI' ||
            q.exchange === 'BSE' ||
            q.exchDisp === 'NSE' ||
            q.exchDisp === 'BSE' ||
            q.quoteType === 'EQUITY' ||
            q.quoteType === 'ETF' ||
            q.quoteType === 'MUTUALFUND',
        )
        .map((q: any) => ({
          symbol: q.symbol?.replace('.NS', '').replace('.BO', '') || '',
          name: q.longname || q.shortname || q.symbol || '',
          exchange: q.exchDisp || q.exchange || 'NSE',
          currency: 'INR',
          country: 'India',
        }));
    } catch (err: any) {
      this.logger.error(
        `[YahooFinance] Search failed for '${query}': ${err.message}`,
      );
      return [];
    }
  }
}
