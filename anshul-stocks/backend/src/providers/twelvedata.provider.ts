import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IMarketProvider,
  MarketCompanyProfile,
  MarketPriceQuote,
  MarketOhlcData,
  MarketState,
} from './provider.interface';
import { RequestQueue } from './queue';
import { fetchWithTimeout } from '../utils/fetch-timeout';

@Injectable()
export class TwelveDataProvider implements IMarketProvider {
  private readonly logger = new Logger(TwelveDataProvider.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.twelvedata.com';
  private readonly queue: RequestQueue;

  constructor(private readonly configService: ConfigService) {
    this.apiKey =
      this.configService.get<string>('TWELVE_DATA_API_KEY') ||
      process.env.TWELVE_DATA_API_KEY ||
      '';
    if (!this.apiKey) {
      this.logger.warn(
        '[TwelveDataProvider] TWELVE_DATA_API_KEY is not configured.',
      );
    }
    // 8 requests per minute default limit for Twelve Data free tier
    this.queue = new RequestQueue(8, 7500);
  }

  getProviderName(): string {
    return 'Twelve Data';
  }

  private formatSymbol(symbol: string): string {
    let clean = symbol.trim().toUpperCase();
    clean = clean
      .replace(/\.NSE$/i, '.BSE')
      .replace(/\.NS$/i, '.BSE')
      .replace(/\.BO$/i, '.BSE');
    if (clean.includes(':') || clean.includes('.')) return clean;
    return `${clean}.BSE`;
  }

  private async fetchApi<T>(
    endpoint: string,
    params: Record<string, string>,
  ): Promise<T | null> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    Object.entries(params).forEach(([key, val]) =>
      url.searchParams.append(key, val),
    );
    url.searchParams.append('apikey', this.apiKey);

    return this.queue.enqueue(async () => {
      const response = await fetchWithTimeout(url.toString(), {}, 5000);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} - ${response.statusText}`);
      }
      const data = await response.json();
      if (data.status === 'error' || data.code === 400 || data.code === 429) {
        throw new Error(
          `Twelve Data API Error: ${data.message || 'Unknown error'}`,
        );
      }
      return data as T;
    });
  }

  async getCompanyProfile(
    symbol: string,
  ): Promise<MarketCompanyProfile | null> {
    try {
      const formatted = this.formatSymbol(symbol);
      const data = await this.fetchApi<any>('/profile', { symbol: formatted });

      if (!data || !data.name) return null;

      return {
        symbol: symbol.toUpperCase(),
        name: data.name,
        exchange: data.exchange || 'NSE',
        currency: data.currency || 'INR',
        country: data.country || 'India',
        sector: data.sector || 'General',
        industry: data.industry || 'General',
        description: data.description || '',
        website: data.website || '',
        isin: data.isin || '',
        marketCap: data.market_cap ? Number(data.market_cap) : undefined,
      };
    } catch (err: any) {
      this.logger.error(
        `[TwelveData] Failed to fetch profile for ${symbol}: ${err.message}`,
      );
      return null;
    }
  }

  async getCurrentQuote(symbol: string): Promise<MarketPriceQuote | null> {
    try {
      const formatted = this.formatSymbol(symbol);
      const data = await this.fetchApi<any>('/quote', { symbol: formatted });

      if (!data || !data.close) return null;

      const currentPrice = Number(data.close || data.price || 0);
      const open = Number(data.open || currentPrice);
      const high = Number(data.high || currentPrice);
      const low = Number(data.low || currentPrice);
      const previousClose = Number(data.previous_close || currentPrice);
      const change = Number(data.change || currentPrice - previousClose);
      const percentChange = Number(data.percent_change || 0);
      const volume = Number(data.volume || 0);

      return {
        symbol: symbol.toUpperCase(),
        currentPrice,
        open,
        high,
        low,
        close: currentPrice,
        previousClose,
        change,
        percentChange,
        volume,
        timestamp: new Date(),
      };
    } catch (err: any) {
      this.logger.error(
        `[TwelveData] Failed to fetch quote for ${symbol}: ${err.message}`,
      );
      return null;
    }
  }

  async getDailyOhlc(symbol: string): Promise<MarketOhlcData | null> {
    try {
      const formatted = this.formatSymbol(symbol);
      const data = await this.fetchApi<any>('/time_series', {
        symbol: formatted,
        interval: '1day',
        outputsize: '1',
      });

      if (!data || !data.values || data.values.length === 0) return null;

      const latest = data.values[0];

      return {
        symbol: symbol.toUpperCase(),
        open: Number(latest.open),
        high: Number(latest.high),
        low: Number(latest.low),
        close: Number(latest.close),
        volume: Number(latest.volume),
        date: latest.datetime,
      };
    } catch (err: any) {
      this.logger.error(
        `[TwelveData] Failed to fetch daily OHLC for ${symbol}: ${err.message}`,
      );
      return null;
    }
  }

  async getMarketStatus(exchange = 'NSE'): Promise<MarketState> {
    try {
      const data = await this.fetchApi<any>('/market_state', { exchange });

      if (Array.isArray(data) && data.length > 0) {
        return {
          exchange,
          isOpen: data[0].is_market_open ?? false,
          code: data[0].code,
        };
      }

      return {
        exchange,
        isOpen: true, // Default to true if unconfirmed
      };
    } catch (err: any) {
      this.logger.warn(
        `[TwelveData] Unable to fetch market status for ${exchange}: ${err.message}`,
      );
      return { exchange, isOpen: true };
    }
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
      const data = await this.fetchApi<any>('/symbol_search', {
        symbol: query,
      });

      if (!data || !data.data || !Array.isArray(data.data)) return [];

      return data.data
        .filter(
          (item: any) =>
            item.country === 'India' ||
            item.exchange === 'NSE' ||
            item.exchange === 'BSE',
        )
        .map((item: any) => ({
          symbol: item.symbol,
          name: item.instrument_name || item.symbol,
          exchange: item.exchange || 'NSE',
          currency: item.currency || 'INR',
          country: item.country || 'India',
        }));
    } catch (err: any) {
      this.logger.error(
        `[TwelveData] Failed to search symbols for query '${query}': ${err.message}`,
      );
      return [];
    }
  }
}
