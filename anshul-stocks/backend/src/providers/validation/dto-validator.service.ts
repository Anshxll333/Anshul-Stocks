import { Injectable } from '@nestjs/common';
import { ProviderValidationException } from '../../common/exceptions/provider-typed.exception';
import { MarketQuoteDTO } from '../dto/market-quote.dto';
import { FinancialMetricDTO } from '../dto/financial-metric.dto';
import { IPODataDTO } from '../dto/ipo-data.dto';

@Injectable()
export class DtoValidatorService {
  validateMarketQuote(quote: MarketQuoteDTO): void {
    if (
      !quote.symbol ||
      typeof quote.symbol !== 'string' ||
      quote.symbol.trim().length === 0
    ) {
      throw new ProviderValidationException(
        'Invalid or missing stock symbol in MarketQuoteDTO',
      );
    }

    if (
      quote.currentPrice !== null &&
      (isNaN(quote.currentPrice) || quote.currentPrice < 0)
    ) {
      throw new ProviderValidationException(
        `Invalid currentPrice (${quote.currentPrice}) for symbol ${quote.symbol}`,
      );
    }

    if (quote.volume !== null && (isNaN(quote.volume) || quote.volume < 0)) {
      throw new ProviderValidationException(
        `Invalid volume (${quote.volume}) for symbol ${quote.symbol}`,
      );
    }

    if (isNaN(new Date(quote.timestamp).getTime())) {
      throw new ProviderValidationException(
        `Invalid timestamp (${quote.timestamp}) for symbol ${quote.symbol}`,
      );
    }
  }

  validateFinancialMetric(metric: FinancialMetricDTO): void {
    if (!metric.symbol || typeof metric.symbol !== 'string') {
      throw new ProviderValidationException(
        'Invalid or missing symbol in FinancialMetricDTO',
      );
    }

    const checkNumber = (val: number | null, name: string) => {
      if (val !== null && val !== undefined && (isNaN(val) || !isFinite(val))) {
        throw new ProviderValidationException(
          `Invalid numeric value for field '${name}' (${val}) in symbol ${metric.symbol}`,
        );
      }
    };

    checkNumber(metric.revenueCr, 'revenueCr');
    checkNumber(metric.netProfitCr, 'netProfitCr');
    checkNumber(metric.eps, 'eps');
    checkNumber(metric.peRatio, 'peRatio');
    checkNumber(metric.pbRatio, 'pbRatio');
    checkNumber(metric.roe, 'roe');
    checkNumber(metric.roce, 'roce');
    checkNumber(metric.debtToEquity, 'debtToEquity');
  }

  validateIPOData(ipo: IPODataDTO): void {
    if (
      !ipo.companyName ||
      typeof ipo.companyName !== 'string' ||
      ipo.companyName.trim().length === 0
    ) {
      throw new ProviderValidationException(
        'Invalid or missing companyName in IPODataDTO',
      );
    }

    if (
      ipo.lotSize !== null &&
      ipo.lotSize !== undefined &&
      (isNaN(ipo.lotSize) || ipo.lotSize <= 0)
    ) {
      throw new ProviderValidationException(
        `Invalid lotSize (${ipo.lotSize}) for IPO ${ipo.companyName}`,
      );
    }
  }
}
