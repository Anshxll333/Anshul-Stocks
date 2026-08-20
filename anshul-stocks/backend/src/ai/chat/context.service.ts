import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DRIZZLE_CONNECTION } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { messages } from '../../database/schema';
import { eq, desc } from 'drizzle-orm';
import { ChatMessagePayload } from '../../providers/ai-provider.interface';
import { PromptBuilder } from '../prompts/prompt.builder';
import { AppLogger } from '../../utils/logger';
import { estimateTokenCount } from '../utils/token-counter';

@Injectable()
export class ContextService {
  private readonly maxContextMessages: number;
  private readonly maxContextMessageChars: number;
  private readonly maxContextUserMessageChars: number;
  private readonly maxHistoryBytes: number;

  constructor(
    @Inject(DRIZZLE_CONNECTION) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
    private readonly promptBuilder: PromptBuilder,
    private readonly appLogger: AppLogger,
  ) {
    this.maxContextMessages =
      this.configService.get<number>('ai.maxContextMessages') || 8;
    this.maxContextMessageChars =
      this.configService.get<number>('ai.maxContextMessageChars') || 1500;
    this.maxContextUserMessageChars =
      this.configService.get<number>('ai.maxContextUserMessageChars') || 600;
    this.maxHistoryBytes =
      this.configService.get<number>('ai.maxHistoryBytes') || 12000;
  }

  async buildContextWindow(
    conversationId: number,
    currentPrompt: string,
    toolContext?: string,
    requestIdArg?: string,
  ): Promise<ChatMessagePayload[]> {
    const startTime = Date.now();
    const requestId =
      requestIdArg || `req-${Math.random().toString(36).substring(2, 9)}`;

    // 1. Fetch recent history from DB
    const dbMessages = await this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(this.maxContextMessages);

    // dbMessages are newest-first; iterate them newest→oldest so that when the
    // total history byte cap is hit the OLDEST messages are dropped, then
    // reverse at the end to restore chronological order for the prompt.

    // 2. Build system prompt
    const systemPromptContent = this.promptBuilder.buildSystemPrompt();

    const payload: ChatMessagePayload[] = [
      { role: 'system', content: systemPromptContent },
    ];

    let historySizeBytes = 0;
    let historyMessageCount = 0;
    let truncatedMessageCount = 0;
    const historyPayload: ChatMessagePayload[] = [];
    // 3. Inject conversation history (bounded & truncated), newest kept first.
    //    Each assistant reply is a large JSON decision card; without bounds the
    //    prompt payload grows with every exchange and the model becomes very
    //    slow to produce the first token. Truncate oversized messages and drop
    //    the oldest once the total history byte cap is reached.
    for (const msg of dbMessages) {
      let content = msg.content;
      const maxChars =
        msg.role === 'assistant'
          ? this.maxContextMessageChars
          : this.maxContextUserMessageChars;
      if (content.length > maxChars) {
        content = `${content.slice(0, maxChars)}\n...[context truncated]`;
        truncatedMessageCount += 1;
      }
      const bytes = Buffer.byteLength(content, 'utf8');
      if (historySizeBytes + bytes > this.maxHistoryBytes) {
        continue;
      }
      historySizeBytes += bytes;
      historyMessageCount += 1;
      historyPayload.push({
        role: msg.role as 'user' | 'assistant' | 'system',
        content,
      });
    }
    payload.push(...historyPayload.reverse());

    let userContent = toolContext
      ? `${currentPrompt}\n\n${toolContext}`
      : currentPrompt;

    if (toolContext) {
      if (toolContext.startsWith('[GROUND TRUTH LIVE FINANCIAL JSON FOR ')) {
        const symbolMatch = toolContext.match(/FOR (.*?)\]:/);
        const symbol = symbolMatch ? symbolMatch[1] : 'Stock';
        userContent = `User Query: ${currentPrompt}\n\n${this.promptBuilder.buildStockPrompt(symbol, toolContext)}`;
      } else if (toolContext.startsWith('[GROUND TRUTH IPO PROSPECTUS JSON FROM POSTGRESQL FOR ')) {
        const companyMatch = toolContext.match(/FOR (.*?)\]:/);
        const companyName = companyMatch ? companyMatch[1] : 'IPO';
        userContent = `User Query: ${currentPrompt}\n\n${this.promptBuilder.buildIpoPrompt(companyName, toolContext)}`;
      }
    }

    payload.push({ role: 'user', content: userContent });

    const systemPromptSizeBytes = Buffer.byteLength(
      systemPromptContent,
      'utf8',
    );
    const groundTruthJsonSizeBytes = toolContext
      ? Buffer.byteLength(toolContext, 'utf8')
      : 0;
    const fullPayloadText = payload.map((p) => p.content).join('\n');
    const estimatedPromptTokens = estimateTokenCount(fullPayloadText);

    this.appLogger.logStageTimeline(
      requestId,
      conversationId,
      'PROMPT_BUILDING',
      'COMPLETED',
      Date.now() - startTime,
      'Context window and prompt payload constructed successfully',
      {
        systemPromptSizeBytes,
        historySizeBytes,
        groundTruthJsonSizeBytes,
        historyMessageCount,
        truncatedMessageCount,
        estimatedPromptTokens,
        hasToolContext: !!toolContext,
      },
    );

    return payload;
  }
}
