import { Injectable } from '@nestjs/common';
import { ITool, ToolMetadata, ToolResult } from './tool.interface';
import { CompanySyncService } from '../../providers/sync/company-sync.service';

@Injectable()
export class StockTool implements ITool<{ symbol: string }, any> {
  constructor(private readonly companySyncService: CompanySyncService) {}

  readonly metadata: ToolMetadata = {
    name: 'stock_fundamentals_lookup',
    description:
      'Retrieves real company profile, current quote, 52-week high/low, volume, sector, and industry.',
    parametersSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock symbol (e.g. RELIANCE, TCS, HDFCBANK)',
        },
      },
      required: ['symbol'],
    },
  };

  async execute(input: { symbol: string }): Promise<ToolResult<any>> {
    const startTime = Date.now();
    const { profile, quote } =
      await this.companySyncService.syncCompanyAndQuote(input.symbol);

    return {
      success: true,
      toolName: this.metadata.name,
      data: {
        symbol: profile.symbol,
        companyName: profile.companyName,
        exchange: profile.exchange,
        sector: profile.sector,
        industry: profile.industry,
        marketCapCr: profile.marketCapCr,
        currentPrice: quote.currentPrice,
        open: quote.open,
        high: quote.high,
        low: quote.low,
        close: quote.close,
        high52w: profile.high52,
        low52w: profile.low52,
        volume: quote.volume,
        changePercent: quote.changePercent,
        description: profile.description,
        timestamp: quote.timestamp,
      },
      executionTimeMs: Date.now() - startTime,
    };
  }
}
