import { Injectable } from '@nestjs/common';
import { ITool, ToolMetadata, ToolResult } from './tool.interface';
import { IpoSyncService } from '../../providers/sync/ipo-sync.service';

export interface IpoToolInput {
  companyName?: string;
  listQuery?: boolean;
}

/**
 * IPO prospectus / listing data tool.
 *
 * Data source: synchronized PostgreSQL `ipo_data` table (via
 * IpoSyncService.getIpoForMentor). Never reads from AI memory.
 *  - listQuery  -> all active (open + upcoming) IPOs
 *  - companyName -> the single matching IPO by company name or symbol
 */
@Injectable()
export class IpoTool implements ITool<IpoToolInput, any> {
  constructor(private readonly ipoSyncService: IpoSyncService) {}

  readonly metadata: ToolMetadata = {
    name: 'ipo_prospectus_lookup',
    description:
      'Retrieves real IPO data from PostgreSQL: Issue Price, Price Band, Lot Size, Issue Size, Dates, Registrar, Subscriptions, GMP, GMP %, and Listing Gain.',
    parametersSchema: {
      type: 'object',
      properties: {
        companyName: {
          type: 'string',
          description: 'Name of the IPO company (e.g. Swiggy, Hyundai)',
        },
        listQuery: {
          type: 'boolean',
          description:
            'When true, returns all current open/upcoming IPOs from PostgreSQL',
        },
      },
    },
  };

  /**
   * Returns the canonical company name of a CURRENT live/upcoming IPO when the
   * free-text prompt mentions one (e.g. "Analyze Dhoot Transmission" without the
   * literal word "IPO"). Used by ToolRouter to rescue IPO questions that were
   * misdetected as stock_lookup / general — the fix for the AI scoring an IPO
   * "0 / 10" with no risk profile because it never received the ground-truth
   * IPO JSON. Reads live PostgreSQL data only; never hardcodes company names.
   */
  async matchCurrentIpo(prompt: string): Promise<string | null> {
    try {
      const current = await this.ipoSyncService.getCurrentIpos();
      const names = [...current.live, ...current.upcoming]
        .map((r) => String((r as any).companyName || '').trim().toLowerCase())
        .filter(Boolean);
      const lower = String(prompt || '').trim().toLowerCase();
      return names.find((name) => lower.includes(name)) || null;
    } catch {
      return null;
    }
  }

  async execute(input: IpoToolInput): Promise<ToolResult<any>> {
    const startTime = Date.now();
    const ipo = await this.ipoSyncService.getIpoForMentor({
      companyName: input.companyName,
      listQuery: !!input.listQuery,
    });

    return {
      success: true,
      toolName: this.metadata.name,
      data: ipo,
      executionTimeMs: Date.now() - startTime,
    };
  }
}
