import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { StockTool } from './tools/stock.tool';
import { FinancialTool } from './tools/financial.tool';
import { IpoTool } from './tools/ipo.tool';
import { VisionTool } from './tools/vision.tool';
import { NewsTool } from './tools/news.tool';
import { CalculatorTool } from './tools/calculator.tool';
import { ToolRouter } from './tools/tool.router';
import { IntentDetector } from './tools/intent-detector';
import { PromptBuilder } from './prompts/prompt.builder';
import { ChatService } from './chat/chat.service';
import { ChatController } from './chat/chat.controller';
import { ConversationAiService } from './chat/conversation.service';
import { MemoryService } from './chat/memory.service';
import { ContextService } from './chat/context.service';
import { StreamService } from './chat/stream.service';
import { ResponseService } from './chat/response.service';
import { AnalysisService } from './analysis/analysis.service';
import { VisionService } from './vision/vision.service';
import { IpoAiService } from './ipo/ipo.service';
import { StockAiService } from './stock/stock.service';
import { AiOrchestratorService } from './services/ai-orchestrator.service';
import { ScoreEngine } from './services/score.engine';
import { AppLogger } from '../utils/logger';

@Module({
  controllers: [ChatController],
  providers: [
    AiService,
    ToolRouter,
    IntentDetector,
    ScoreEngine,
    StockTool,
    FinancialTool,
    IpoTool,
    VisionTool,
    NewsTool,
    CalculatorTool,
    PromptBuilder,
    ChatService,
    ConversationAiService,
    MemoryService,
    ContextService,
    StreamService,
    ResponseService,
    AnalysisService,
    VisionService,
    IpoAiService,
    StockAiService,
    AiOrchestratorService,
    AppLogger,
  ],
  exports: [
    AiService,
    ToolRouter,
    IntentDetector,
    ScoreEngine,
    StockTool,
    FinancialTool,
    IpoTool,
    VisionTool,
    NewsTool,
    CalculatorTool,
    PromptBuilder,
    ChatService,
    ConversationAiService,
    MemoryService,
    ContextService,
    StreamService,
    ResponseService,
    AnalysisService,
    VisionService,
    IpoAiService,
    StockAiService,
    AiOrchestratorService,
    AppLogger,
  ],
})
export class AiModule {}
