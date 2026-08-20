import { Injectable } from '@nestjs/common';
import { ITool, ToolMetadata, ToolResult } from './tool.interface';
import { FinancialSyncService } from '../../providers/sync/financial-sync.service';

@Injectable()
export class FinancialTool implements ITool<{ symbol: string }, any> {
  constructor(private readonly financialSyncService: FinancialSyncService) {}

  readonly metadata: ToolMetadata = {
    name: 'financial_ratios_lookup',
    description:
      'Retrieves fundamental metrics: Revenue, Net Profit, EPS, Book Value, PE, PB, ROE, ROCE, Debt-to-Equity, Operating Margin, Free Cash Flow.',
    parametersSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock symbol (e.g. RELIANCE, TCS)',
        },
      },
      required: ['symbol'],
    },
  };

  async execute(input: { symbol: string }): Promise<ToolResult<any>> {
    const startTime = Date.now();
    const metrics = await this.financialSyncService.syncFinancials(
      input.symbol,
    );

    return {
      success: true,
      toolName: this.metadata.name,
      data: metrics,
      executionTimeMs: Date.now() - startTime,
    };
  }
}
