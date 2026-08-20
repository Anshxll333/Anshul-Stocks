import { Injectable } from '@nestjs/common';
import { SYSTEM_PROMPT } from './system.prompt';
import { STOCK_ANALYSIS_PROMPT_TEMPLATE } from './stock.prompt';
import { IPO_ANALYSIS_PROMPT_TEMPLATE } from './ipo.prompt';
import { VISION_ANALYSIS_PROMPT_TEMPLATE } from './vision.prompt';

@Injectable()
export class PromptBuilder {
  buildSystemPrompt(userRole: string = 'investor'): string {
    return `${SYSTEM_PROMPT}

CRITICAL DATA RECOVERY & DETERMINISTIC SCORE MAPPING INSTRUCTION:
When a [GROUND TRUTH ... JSON] block is provided in the prompt context:
1. You MUST strictly set "overallAiRating" to the exact "calculatedScore.overallScore" value provided in the JSON payload (e.g. if calculatedScore.overallScore is 7.4, output 7.4).
2. You MUST populate the 8 fundamental cards ("revenueGrowth", "profitGrowth", "roe", "roce", "debt", "valuation", "businessQuality", "managementQuality") using the exact strings provided in "calculatedScore.fundamentalCards" or derived directly from the ground truth JSON context.
3. Never output "This information is currently unavailable" for metrics that exist inside the ground truth JSON payload.`;
  }

  buildStockPrompt(symbol: string, context?: string): string {
    return STOCK_ANALYSIS_PROMPT_TEMPLATE(symbol, context);
  }

  buildIpoPrompt(companyName: string, context?: string): string {
    return IPO_ANALYSIS_PROMPT_TEMPLATE(companyName, context);
  }

  buildVisionPrompt(imageType: string): string {
    return VISION_ANALYSIS_PROMPT_TEMPLATE(imageType);
  }
}
