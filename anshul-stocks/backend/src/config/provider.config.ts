import { registerAs } from '@nestjs/config';

export interface ProviderConfig {
  marketProvider: string;
  financialProvider: string;
  ipoProvider: string;
  newsProvider: string;
  twelveDataApiKey: string;
  rateLimitRequestsPerMin: number;
  retryAttempts: number;
  cacheTtlSeconds: number;
  providerTimeoutMs: number;
}

export default registerAs('provider', (): ProviderConfig => ({
  marketProvider: process.env.MARKET_PROVIDER || 'twelvedata',
  financialProvider: process.env.FINANCIAL_PROVIDER || 'twelvedata',
  ipoProvider: process.env.IPO_PROVIDER || 'twelvedata',
  newsProvider: process.env.NEWS_PROVIDER || 'twelvedata',
  twelveDataApiKey:
    process.env.TWELVE_DATA_API_KEY || 'b6aff7dd6dea42e4b43a1e04dd1e8d31',
  rateLimitRequestsPerMin: parseInt(process.env.RATE_LIMIT_RPM || '60', 10),
  retryAttempts: parseInt(process.env.PROVIDER_RETRY_COUNT || '3', 10),
  cacheTtlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '3600', 10),
  providerTimeoutMs: parseInt(process.env.PROVIDER_TIMEOUT_MS || '10000', 10),
}));
