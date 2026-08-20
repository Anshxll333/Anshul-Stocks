import { Injectable } from '@nestjs/common';
import { StockTool } from '../tools/stock.tool';
import { IpoTool } from '../tools/ipo.tool';
import { VisionTool } from '../tools/vision.tool';
import { NewsTool } from '../tools/news.tool';
import { CalculatorTool } from '../tools/calculator.tool';

@Injectable()
export class AiOrchestratorService {
  constructor(
    private readonly stockTool: StockTool,
    private readonly ipoTool: IpoTool,
    private readonly visionTool: VisionTool,
    private readonly newsTool: NewsTool,
    private readonly calculatorTool: CalculatorTool,
  ) {}

  getAvailableTools() {
    return [
      this.stockTool.metadata,
      this.ipoTool.metadata,
      this.visionTool.metadata,
      this.newsTool.metadata,
      this.calculatorTool.metadata,
    ];
  }
}
