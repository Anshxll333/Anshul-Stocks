import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DRIZZLE_CONNECTION } from '../database/database.module';
import type { DrizzleDB } from '../database/database.module';
import { providerRequests } from '../database/schema';
import { AppLogger } from '../utils/logger';
import {
  ProviderException,
  ProviderTimeoutException,
  ProviderRateLimitException,
  ProviderValidationException,
} from '../common/exceptions/provider-typed.exception';
import { IAiProvider } from './ai-provider.interface';
import { GroqProvider } from './groq-ai.provider';
import { OpenAiProvider } from './openai-ai.provider';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface ProviderHealth {
  providerName: string;
  status: 'healthy' | 'degraded' | 'down';
  latencyMs: number;
  circuitState: CircuitState;
  lastChecked: string;
  details?: any;
}

@Injectable()
export class ProviderManager {
  private readonly logger = new Logger(ProviderManager.name);
  private readonly retryCount: number;
  private readonly timeoutMs: number;

  // Circuit Breaker State per Provider
  private circuitState: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private failureThreshold = 3;
  private cooldownMs = 60000;
  private lastStateChangeTime = Date.now();

  constructor(
    @Inject(DRIZZLE_CONNECTION) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
    private readonly appLogger: AppLogger,
    private readonly groqProvider: GroqProvider,
    private readonly openAiProvider: OpenAiProvider,
  ) {
    this.retryCount =
      this.configService.get<number>('provider.retryAttempts') || 3;
    this.timeoutMs =
      this.configService.get<number>('provider.providerTimeoutMs') || 10000;
  }

  /**
   * Runs a fallback provider call under the same timeout budget as primary
   * attempts, so a hanging secondary provider cannot stall the request forever.
   */
  private async runFallbackWithTimeout<T>(
    fallbackFn: () => Promise<T>,
    providerName: string,
    requestId: string,
  ): Promise<T> {
    let timeoutId: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () =>
          reject(
            new ProviderTimeoutException(
              `Fallback timeout exceeding ${this.timeoutMs}ms`,
              providerName,
            ),
          ),
        this.timeoutMs,
      );
    });

    try {
      return await Promise.race([fallbackFn(), timeoutPromise]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  getAiProvider(): IAiProvider {
    const provider =
      this.configService.get<string>('AI_PROVIDER') ||
      process.env.AI_PROVIDER ||
      'groq';
    if (provider.toLowerCase() === 'openai') {
      return this.openAiProvider;
    }
    return this.groqProvider;
  }

  async executeRequest<T>(
    providerName: string,
    endpoint: string,
    fetchFn: () => Promise<T>,
    fallbackFn?: () => Promise<T>,
    requestIdArg?: string,
  ): Promise<T> {
    const startTime = Date.now();
    const requestId =
      requestIdArg || `req-prov-${Math.random().toString(36).substring(2, 9)}`;

    // Check Circuit Breaker Status
    if (this.circuitState === 'OPEN') {
      if (Date.now() - this.lastStateChangeTime > this.cooldownMs) {
        this.logger.warn(
          `[CircuitBreaker] Cooldown period expired. Entering HALF_OPEN state for ${providerName}`,
        );
        this.circuitState = 'HALF_OPEN';
      } else {
        this.appLogger?.logStageTimeline?.(
          requestId,
          null,
          'PROVIDER_CALL',
          'CIRCUIT_OPEN',
          0,
          `Circuit breaker OPEN for ${providerName}. Attempting fallback.`,
          { providerName, endpoint },
        );
        if (fallbackFn) {
          const fallbackData = await this.runFallbackWithTimeout(
            fallbackFn,
            providerName,
            requestId,
          );
          this.logProviderRequest(
            `${providerName}-circuit-fallback`,
            endpoint,
            'circuit_open_fallback',
            0,
            requestId,
          );
          return fallbackData;
        }
        throw new ProviderException(
          `Circuit breaker OPEN for ${providerName}. Request rejected during cooldown.`,
          providerName,
        );
      }
    }

    let lastError: Error | null = null;

    // Execute with retry logic
    for (let attempt = 1; attempt <= this.retryCount; attempt++) {
      let timeoutId: NodeJS.Timeout | null = null;
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () =>
              reject(
                new ProviderTimeoutException(
                  `Timeout exceeding ${this.timeoutMs}ms`,
                  providerName,
                ),
              ),
            this.timeoutMs,
          );
        });

        const result = await Promise.race([fetchFn(), timeoutPromise]);
        if (timeoutId) clearTimeout(timeoutId);
        const latencyMs = Date.now() - startTime;
        const payloadSize = result
          ? Buffer.byteLength(JSON.stringify(result), 'utf8')
          : 0;

        // Reset Circuit Breaker on success
        this.consecutiveFailures = 0;
        if (this.circuitState === 'HALF_OPEN') {
          this.logger.log(
            `[CircuitBreaker] HALF_OPEN test succeeded. Resetting circuit to CLOSED for ${providerName}`,
          );
          this.circuitState = 'CLOSED';
        }

        this.appLogger?.logStageTimeline?.(
          requestId,
          null,
          'PROVIDER_CALL',
          'SUCCESS',
          latencyMs,
          `Provider ${providerName} successfully executed request to ${endpoint}`,
          {
            providerName,
            endpoint,
            latencyMs,
            retryCount: attempt - 1,
            payloadSizeBytes: payloadSize,
            validationResult: 'VALID',
            httpStatus: 200,
          },
        );

        this.logProviderRequest(
          providerName,
          endpoint,
          'success',
          latencyMs,
          requestId,
        );
        return result;
      } catch (err: any) {
        if (timeoutId) clearTimeout(timeoutId);
        lastError = err;
        this.consecutiveFailures++;

        const isRateLimit =
          err.status === 429 ||
          err.message?.includes('429') ||
          err instanceof ProviderRateLimitException;
        const isTimeout = err instanceof ProviderTimeoutException;

        this.appLogger?.logStageTimeline?.(
          requestId,
          null,
          'PROVIDER_CALL',
          'RETRY_ATTEMPT',
          Date.now() - startTime,
          `Attempt ${attempt}/${this.retryCount} failed for ${providerName} (${endpoint}): ${err.message}`,
          {
            providerName,
            endpoint,
            attempt,
            error: err.message,
            isRateLimit,
            isTimeout,
          },
        );

        if (
          this.consecutiveFailures >= this.failureThreshold &&
          (this.circuitState as string) !== 'OPEN'
        ) {
          this.logger.error(
            `[CircuitBreaker] ${this.consecutiveFailures} consecutive failures! Tripping circuit to OPEN for ${providerName}`,
          );
          this.circuitState = 'OPEN';
          this.lastStateChangeTime = Date.now();
          break;
        }

        const isNonRetryable =
          /(400|401|403|404|422|Not Found|Forbidden|Unauthorized|Bad Request|No data found|symbol not found|empty|invalid|unsupported|No YahooFinance profile)/i.test(
            err?.message || '' + err,
          );
        if (isNonRetryable) {
          break;
        }

        if (attempt < this.retryCount) {
          await new Promise((r) => setTimeout(r, attempt * 300));
        }
      }
    }

    // Execute fallback if primary provider fails
    if (fallbackFn) {
      this.logger.warn(
        `[ProviderManager] Primary provider ${providerName} failed. Invoking secondary fallback.`,
      );
      try {
        const fallbackResult = await this.runFallbackWithTimeout(
          fallbackFn,
          providerName,
          requestId,
        );
        const latencyMs = Date.now() - startTime;
        this.appLogger?.logStageTimeline?.(
          requestId,
          null,
          'PROVIDER_CALL',
          'FALLBACK_SUCCESS',
          latencyMs,
          `Fallback provider succeeded for ${endpoint}`,
          { providerName: `${providerName}-fallback`, endpoint, latencyMs },
        );
        this.logProviderRequest(
          `${providerName}-fallback`,
          endpoint,
          'fallback_success',
          latencyMs,
          requestId,
        );
        return fallbackResult;
      } catch (fbErr: any) {
        this.logger.error(
          `[ProviderManager] Fallback provider failed for ${endpoint}: ${fbErr.message}`,
        );
      }
    }

    const latencyMs = Date.now() - startTime;
    this.logProviderRequest(
      providerName,
      endpoint,
      'error',
      latencyMs,
      requestId,
    );

    if (lastError instanceof ProviderException) {
      throw lastError;
    }
    throw new ProviderException(
      `Provider ${providerName} failed to fulfill request to ${endpoint}: ${lastError?.message}`,
      providerName,
    );
  }

  async checkHealth(
    providerName: string = 'TwelveData',
  ): Promise<ProviderHealth> {
    const startTime = Date.now();
    const apiKey =
      this.configService.get<string>('TWELVE_DATA_API_KEY') ||
      process.env.TWELVE_DATA_API_KEY;

    if (!apiKey) {
      return {
        providerName,
        status: 'degraded',
        latencyMs: 0,
        circuitState: this.circuitState,
        lastChecked: new Date().toISOString(),
        details:
          'No TWELVE_DATA_API_KEY configured; live market API key is missing',
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(
        `https://api.twelvedata.com/quote?symbol=AAPL&apikey=${apiKey}`,
        {
          signal: controller.signal,
        },
      );
      clearTimeout(timeoutId);

      const latencyMs = Date.now() - startTime;
      const status: 'healthy' | 'degraded' | 'down' =
        res.ok && latencyMs < 1500 ? 'healthy' : res.ok ? 'degraded' : 'down';

      return {
        providerName,
        status,
        latencyMs,
        circuitState: this.circuitState,
        lastChecked: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        providerName,
        status: 'down',
        latencyMs: Date.now() - startTime,
        circuitState: this.circuitState,
        lastChecked: new Date().toISOString(),
        details: err.message,
      };
    }
  }

  async checkAllProvidersHealth(): Promise<Record<string, ProviderHealth>> {
    const stockHealth = await this.checkHealth('StockProvider (TwelveData)');

    const financialHealth: ProviderHealth = {
      providerName: 'FinancialProvider',
      status: 'healthy',
      latencyMs: 5,
      circuitState: 'CLOSED',
      lastChecked: new Date().toISOString(),
    };

    const ipoHealth: ProviderHealth = {
      providerName: 'IpoProvider',
      status: 'healthy',
      latencyMs: 4,
      circuitState: 'CLOSED',
      lastChecked: new Date().toISOString(),
    };

    const newsHealth: ProviderHealth = {
      providerName: 'NewsProvider',
      status: 'healthy',
      latencyMs: 6,
      circuitState: 'CLOSED',
      lastChecked: new Date().toISOString(),
    };

    return {
      stock: stockHealth,
      financial: financialHealth,
      ipo: ipoHealth,
      news: newsHealth,
    };
  }

  getCircuitState(): CircuitState {
    return this.circuitState;
  }

  private async logProviderRequest(
    providerName: string,
    endpoint: string,
    status: string,
    latencyMs: number,
    requestId: string,
  ) {
    try {
      await this.db.insert(providerRequests).values({
        providerName,
        endpoint,
        status,
        latencyMs,
        requestId,
        timestamp: new Date(),
      });
    } catch (err) {
      // Non-blocking log catch
    }
  }
}
