import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { users, conversations, messages } from '../../database/schema';
import { eq, desc, and } from 'drizzle-orm';
import { ProviderManager } from '../../providers/provider.manager';
import { ToolRouter, ToolRoutingDecision } from '../tools/tool.router';
import { ContextService } from './context.service';
import { AppLogger } from '../../utils/logger';
import { repairDecisionJsonBlock } from './json-repair';

@Injectable()
export class ChatService {
  // In-memory request deduplication lock (TTL: 10s)
  private readonly recentRequests = new Map<string, number>();

  constructor(
    @Inject(DRIZZLE_CONNECTION) private readonly db: DrizzleDB,
    private readonly providerManager: ProviderManager,
    private readonly toolRouter: ToolRouter,
    private readonly contextService: ContextService,
    private readonly logger: AppLogger,
  ) {}

  private isDuplicateRequest(requestId: string): boolean {
    const now = Date.now();
    // Cleanup old requests (> 10s)
    for (const [id, time] of this.recentRequests.entries()) {
      if (now - time > 10000) this.recentRequests.delete(id);
    }
    if (this.recentRequests.has(requestId)) {
      return true;
    }
    this.recentRequests.set(requestId, now);
    return false;
  }

  private async ensureUser(userId: number): Promise<void> {
    const [existing] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!existing) {
      await this.db
        .insert(users)
        .values({
          id: userId,
          email: 'investor@anshulstocks.com',
          passwordHash: 'secure_investor_hash',
          fullName: 'Anshul Stocks Investor',
        })
        .onConflictDoNothing();
    }
  }

  /**
   * Builds a graceful fallback routing decision when tool execution is too slow or errors.
   * The chat continues without ground-truth context rather than hanging the user.
   */
  private buildFallbackToolRouting(
    requestId: string,
    reason: string,
  ): ToolRoutingDecision {
    this.logger.warn(
      `[ChatService] ${reason} (requestId: ${requestId}). Continuing without ground-truth context.`,
    );
    return {
      detectedIntent: { intent: 'general', confidence: 0.5 },
      toolExecuted: null,
      result: null,
      contextString: undefined,
      structuredJsonPayload: undefined,
      executionTimeMs: 0,
      providerUsed: 'InternalEngine',
      contextJsonSize: 0,
    };
  }

  /**
   * Runs the Tool Router with a hard wall-clock timeout so live-data lookups
   * (Yahoo/12data retries, news, etc.) can never block the first token indefinitely.
   */
  private async runToolRoutingWithTimeout(
    userMessage: string,
    requestId: string,
    conversationId: number | null,
    timeoutMs = process.env.TOOL_ROUTING_TIMEOUT_MS ? parseInt(process.env.TOOL_ROUTING_TIMEOUT_MS) : 35000,
  ): Promise<ToolRoutingDecision> {
    let timeoutId: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<ToolRoutingDecision>((resolve) => {
      timeoutId = setTimeout(
        () =>
          resolve(
            this.buildFallbackToolRouting(
              requestId,
              `Tool routing exceeded ${timeoutMs / 1000}s`,
            ),
          ),
        timeoutMs,
      );
    });

    try {
      return await Promise.race([
        this.toolRouter.routeAndExecute(userMessage, requestId, conversationId),
        timeoutPromise,
      ]);
    } catch (err: any) {
      return this.buildFallbackToolRouting(
        requestId,
        `Tool routing failed (${err.message})`,
      );
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  /**
   * Reuses an existing conversation instead of creating a duplicate thread when
   * the exact same question is being asked again (e.g. retries, refresh-related
   * resubmissions, or re-clicking a Home prompt pill). A conversation is only
   * reused when its title matches AND its most recent user message equals the
   * incoming prompt — so genuinely different questions still start a new chat.
   * This replaces the old 60-second time window which let duplicates accumulate
   * for repeated prompts sent more than a minute apart.
   */
  private async findReusableConversation(
    userId: number,
    titleCandidate: string,
    prompt: string,
    recentConvs: Array<{ id: number; title: string | null }>,
  ): Promise<{ id: number } | null> {
    for (const c of recentConvs) {
      if (c.title !== titleCandidate) continue;
      // The most recent message in a conversation is the assistant reply, so we
      // must look up the LAST USER message to detect a repeated question.
      const [last] = await this.db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, c.id),
            eq(messages.role, 'user'),
          ),
        )
        .orderBy(desc(messages.createdAt))
        .limit(1);
      if (last && last.content === prompt) {
        this.logger.log(
          `[ChatService] Reusing conversation ${c.id} for repeated prompt "${prompt.slice(0, 40)}"`,
        );
        return { id: c.id };
      }
    }
    return null;
  }

  async processChatMessage(
    userId: number,
    conversationId: number | null,
    prompt: string,
    requestIdArg?: string,
  ) {
    const startTime = Date.now();
    const requestId =
      requestIdArg ||
      `req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    if (this.isDuplicateRequest(requestId)) {
      this.logger.warn(
        `[ChatService] Duplicate request detected for ID: ${requestId}. Suppressing duplicate execution.`,
      );
      throw new Error(`Duplicate request detected: ${requestId}`);
    }

    await this.ensureUser(userId);

    // 1. Find or create conversation
    let convId = conversationId;
    if (!convId) {
      const titleCandidate =
        prompt.slice(0, 35) + (prompt.length > 35 ? '...' : '');
      const recentConvs = await this.db
        .select()
        .from(conversations)
        .where(eq(conversations.userId, userId))
        .orderBy(desc(conversations.createdAt))
        .limit(10);

      const duplicateConv = await this.findReusableConversation(
        userId,
        titleCandidate,
        prompt,
        recentConvs,
      );

      if (duplicateConv) {
        convId = duplicateConv.id;
        this.logger.logStageTimeline(
          requestId,
          convId,
          'CONVERSATION_CREATE',
          'SKIPPED_DUPLICATE',
          Date.now() - startTime,
          'Reusing recent duplicate conversation',
          { convId },
        );
      } else {
        const [newConv] = await this.db
          .insert(conversations)
          .values({
            userId,
            title: titleCandidate,
          })
          .returning();
        convId = newConv.id;
        this.logger.logStageTimeline(
          requestId,
          convId,
          'CONVERSATION_CREATE',
          'COMPLETED',
          Date.now() - startTime,
          'Created new conversation',
          { convId },
        );
      }
    } else {
      this.logger.logStageTimeline(
        requestId,
        convId,
        'CONVERSATION_LOAD',
        'COMPLETED',
        Date.now() - startTime,
        'Loaded existing conversation',
        { convId },
      );
    }

    // Check last user message to prevent duplicate consecutive user messages
    const [lastMsg] = await this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, convId))
      .orderBy(desc(messages.createdAt))
      .limit(1);

    let userMsgRecord: any = lastMsg;
    if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== prompt) {
      const [newMsg] = await this.db
        .insert(messages)
        .values({
          conversationId: convId,
          role: 'user',
          content: prompt,
          status: 'completed',
        })
        .returning();
      userMsgRecord = newMsg;
      this.logger.logStageTimeline(
        requestId,
        convId,
        'USER_MESSAGE_SAVE',
        'COMPLETED',
        Date.now() - startTime,
        'User message persisted to DB',
      );
    } else {
      this.logger.logStageTimeline(
        requestId,
        convId,
        'USER_MESSAGE_SAVE',
        'SKIPPED',
        Date.now() - startTime,
        'Duplicate consecutive user message skipped',
      );
    }

    // 3. Route through AI Tool Router (bounded by a hard timeout so slow live
    // data providers can never block the response indefinitely)
    const toolRouting = await this.runToolRoutingWithTimeout(
      prompt,
      requestId,
      convId,
      process.env.TOOL_ROUTING_TIMEOUT_MS ? parseInt(process.env.TOOL_ROUTING_TIMEOUT_MS) : 35000,
    );

    // 4. Assemble Context Window
    const contextMessagesPayload = await this.contextService.buildContextWindow(
      convId,
      prompt,
      toolRouting.contextString,
      requestId,
    );

    // 5. Invoke AI Completion Engine via ProviderManager
    const aiProvider = this.providerManager.getAiProvider();
    const aiResult = await aiProvider.generateCompletion(
      contextMessagesPayload,
      requestId,
    );

    // 6. Persist AI Assistant Message to DB (repair truncated decision JSON so
    //    reloaded conversations render a card instead of raw JSON)
    const [assistantMsgRecord] = await this.db
      .insert(messages)
      .values({
        conversationId: convId,
        role: 'assistant',
        content: repairDecisionJsonBlock(aiResult.content),
        model: aiResult.model,
        status: aiResult.status,
        tokenCount: aiResult.totalTokens,
        responseTime: aiResult.executionTimeMs,
        metadata: JSON.stringify({
          toolExecuted: toolRouting.toolExecuted,
          detectedIntent: toolRouting.detectedIntent.intent,
          providerUsed: toolRouting.providerUsed,
          requestId,
        }),
      })
      .returning();

    this.logger.logStageTimeline(
      requestId,
      convId,
      'ASSISTANT_SAVE',
      'COMPLETED',
      Date.now() - startTime,
      'Assistant response persisted to DB',
    );

    // Touch conversation timestamp
    await this.db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, convId));

    this.logger.logStageTimeline(
      requestId,
      convId,
      'CONVERSATION_UPDATE',
      'COMPLETED',
      Date.now() - startTime,
      'Conversation timestamp updated',
      {
        totalExecutionTimeMs: Date.now() - startTime,
        model: aiResult.model,
        totalTokens: aiResult.totalTokens,
      },
    );

    return {
      requestId,
      conversationId: convId,
      userMessage: userMsgRecord,
      assistantMessage: assistantMsgRecord,
      toolExecuted: toolRouting.toolExecuted,
      detectedIntent: toolRouting.detectedIntent,
      providerUsed: toolRouting.providerUsed,
      metrics: {
        executionTimeMs: Date.now() - startTime,
        totalTokens: aiResult.totalTokens,
        promptTokens: aiResult.promptTokens,
        completionTokens: aiResult.completionTokens,
      },
    };
  }

  async processChatStream(
    userId: number,
    conversationId: number | null,
    prompt: string,
    requestIdArg?: string,
  ): Promise<{
    convId: number;
    requestId: string;
    toolRouting: ToolRoutingDecision;
    stream: AsyncGenerator<string, void, unknown>;
  }> {
    const startTime = Date.now();
    const requestId =
      requestIdArg ||
      `req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    if (this.isDuplicateRequest(requestId)) {
      this.logger.warn(
        `[ChatService Stream] Duplicate request detected for ID: ${requestId}. Suppressing stream creation.`,
      );
      throw new Error(`Duplicate stream request detected: ${requestId}`);
    }

    await this.ensureUser(userId);

    let activeId = conversationId;
    if (!activeId) {
      const titleCandidate =
        prompt.slice(0, 35) + (prompt.length > 35 ? '...' : '');
      const recentConvs = await this.db
        .select()
        .from(conversations)
        .where(eq(conversations.userId, userId))
        .orderBy(desc(conversations.createdAt))
        .limit(10);

      const duplicateConv = await this.findReusableConversation(
        userId,
        titleCandidate,
        prompt,
        recentConvs,
      );

      if (duplicateConv) {
        activeId = duplicateConv.id;
        this.logger.logStageTimeline(
          requestId,
          activeId,
          'CONVERSATION_CREATE',
          'SKIPPED_DUPLICATE',
          Date.now() - startTime,
          'Reusing recent duplicate conversation for stream',
          { convId: activeId },
        );
      } else {
        const [newConv] = await this.db
          .insert(conversations)
          .values({
            userId,
            title: titleCandidate,
          })
          .returning();
        activeId = newConv.id;
        this.logger.logStageTimeline(
          requestId,
          activeId,
          'CONVERSATION_CREATE',
          'COMPLETED',
          Date.now() - startTime,
          'Created new conversation for stream',
          { convId: activeId },
        );
      }
    } else {
      this.logger.logStageTimeline(
        requestId,
        activeId,
        'CONVERSATION_LOAD',
        'COMPLETED',
        Date.now() - startTime,
        'Loaded existing conversation for stream',
        { convId: activeId },
      );
    }

    const targetConvId: number = activeId;

    // Check last user message to prevent duplicate consecutive user messages
    const [lastMsg] = await this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, targetConvId))
      .orderBy(desc(messages.createdAt))
      .limit(1);

    if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== prompt) {
      await this.db.insert(messages).values({
        conversationId: targetConvId,
        role: 'user',
        content: prompt,
        status: 'completed',
      });
      this.logger.logStageTimeline(
        requestId,
        targetConvId,
        'USER_MESSAGE_SAVE',
        'COMPLETED',
        Date.now() - startTime,
        'User message persisted to DB',
      );
    } else {
      this.logger.logStageTimeline(
        requestId,
        targetConvId,
        'USER_MESSAGE_SAVE',
        'SKIPPED',
        Date.now() - startTime,
        'Duplicate user message suppressed',
      );
    }

    // Tool Router & Context (bounded by a hard timeout so slow live data
    // providers can never block the first streaming token indefinitely)
    const toolRouting = await this.runToolRoutingWithTimeout(
      prompt,
      requestId,
      targetConvId,
    );
    const contextPayload = await this.contextService.buildContextWindow(
      targetConvId,
      prompt,
      toolRouting.contextString,
      requestId,
    );

    // Stream generator wrapper to auto-save assistant response upon stream end
    const aiProvider = this.providerManager.getAiProvider();
    const rawStream = aiProvider.generateStream(contextPayload, requestId);
    const db = this.db;
    const modelName = process.env.AI_MODEL || 'mistral/mistral-small-latest';
    const logger = this.logger;

    async function* streamWithSave() {
      let fullText = '';
      let chunkCount = 0;
      try {
        for await (const chunk of rawStream) {
          fullText += chunk;
          chunkCount++;
          yield chunk;
        }

        // Avoid creating empty assistant messages
        if (fullText.trim().length > 0) {
          await db.insert(messages).values({
            conversationId: targetConvId,
            role: 'assistant',
            // Repair truncated decision JSON before persisting so reloaded
            // conversations render the card instead of raw JSON
            content: repairDecisionJsonBlock(fullText),
            model: modelName,
            status: 'completed',
            tokenCount: Math.ceil(fullText.length / 4),
            responseTime: Date.now() - startTime,
            metadata: JSON.stringify({
              toolExecuted: toolRouting.toolExecuted,
              detectedIntent: toolRouting.detectedIntent.intent,
              providerUsed: toolRouting.providerUsed,
              requestId,
            }),
          });

          await db
            .update(conversations)
            .set({ updatedAt: new Date() })
            .where(eq(conversations.id, targetConvId));

          logger.logStageTimeline(
            requestId,
            targetConvId,
            'ASSISTANT_SAVE',
            'COMPLETED',
            Date.now() - startTime,
            'Streamed assistant message persisted',
            {
              chunkCount,
              totalCharacters: fullText.length,
            },
          );
        } else {
          logger.logStageTimeline(
            requestId,
            targetConvId,
            'ASSISTANT_SAVE',
            'SKIPPED',
            Date.now() - startTime,
            'Skipped saving empty assistant message',
          );
        }
      } catch (err: any) {
        logger.logStageTimeline(
          requestId,
          targetConvId,
          'STREAMING',
          'FAILED',
          Date.now() - startTime,
          `Stream error: ${err.message}`,
          { error: err.message },
        );
        throw err;
      }
    }

    return {
      convId: targetConvId,
      requestId,
      toolRouting,
      stream: streamWithSave(),
    };
  }

  async getRecentConversations(userId: number) {
    try {
      const convs = await this.db
        .select()
        .from(conversations)
        .where(eq(conversations.userId, userId))
        .orderBy(desc(conversations.updatedAt))
        .limit(20);

      const result: any[] = [];
      for (const c of convs) {
        const msgs = await this.db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, c.id))
          .orderBy(desc(messages.createdAt))
          .limit(1);

        const lastMsg = msgs[0];
        result.push({
          id: c.id,
          title: c.title || 'Investment Mentor Discussion',
          date: c.updatedAt ? new Date(c.updatedAt).toLocaleString() : 'Recent',
          summary: lastMsg
            ? lastMsg.content.substring(0, 150) + '...'
            : 'Conversation initiated with AI Mentor.',
          type: 'stock',
          status: 'Completed',
        });
      }
      return result;
    } catch (err: any) {
      this.logger.error(
        `Failed to fetch conversations for user ${userId}: ${err.message}`,
      );
      return [];
    }
  }
}
