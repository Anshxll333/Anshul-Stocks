import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FinancialMetricDTO } from './dto/financial-metric.dto';
import { FinancialMapper } from './mappers/financial.mapper';
import { ProviderException } from '../common/exceptions/provider-typed.exception';
import { fetchWithTimeout } from '../utils/fetch-timeout';

@Injectable()
export class FinancialProvider {
  private readonly logger = new Logger(FinancialProvider.name);
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey =
      this.configService.get<string>('TWELVE_DATA_API_KEY') ||
      process.env.TWELVE_DATA_API_KEY ||
      '';
  }

  async getFinancialMetrics(symbol: string): Promise<FinancialMetricDTO> {
    if (!this.apiKey) {
      throw new ProviderException(
        'TWELVE_DATA_API_KEY environment variable is required',
        'FinancialProvider',
      );
    }

    const sym = symbol.toUpperCase();
    const formattedSymbol = sym.includes(':') ? sym : `${sym}:NSE`;

    try {
      const url = `https://api.twelvedata.com/income_statement?symbol=${formattedSymbol}&apikey=${this.apiKey}`;
      const res = await fetchWithTimeout(url, {}, 5000);

      if (res.ok) {
        const json = await res.json();
        if (json.income_statement && json.income_statement.length > 0) {
          const latest = json.income_statement[0];
          return FinancialMapper.toMetricDTO(
            {
              revenue: latest.operating_revenue || latest.total_revenue,
              netIncome: latest.net_income,
              eps: latest.eps,
              updatedAt: latest.fiscal_date,
            },
            sym,
          );
        }
      }
    } catch (err: any) {
      this.logger.warn(
        `[FinancialProvider] Fetch failed for ${sym}: ${err.message}`,
      );
    }

    // Return strict DTO mapped from raw nulls (no hardcoded defaults)
    return FinancialMapper.toMetricDTO({}, sym);
  }
}
