import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import {
  IAiProvider,
  ChatMessagePayload,
  AiCompletionResult,
} from './ai-provider.interface';
import { estimateTokenCount } from '../ai/utils/token-counter';
import { AppLogger } from '../utils/logger';

@Injectable()
export class GroqProvider implements IAiProvider, OnModuleInit {
  private readonly logger = new Logger(GroqProvider.name);
  private client: Groq | null = null;
  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly visionModel: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly appLogger: AppLogger,
  ) {
    this.apiKey =
      this.configService.get<string>('GROQ_API_KEY') ||
      process.env.GROQ_API_KEY ||
      '';
    this.defaultModel =
      this.configService.get<string>('AI_MODEL') ||
      process.env.AI_MODEL ||
      'mistral/mistral-small-latest';
    this.visionModel =
      this.configService.get<string>('VISION_MODEL') ||
      process.env.VISION_MODEL ||
      'mistral/mistral-small-latest';

    if (this.apiKey && this.apiKey.length > 5) {
      this.client = new Groq({ apiKey: this.apiKey });
    }
  }

  async onModuleInit() {
    this.logger.log(`Loaded AI Provider: Groq`);
    this.logger.log(`Loaded AI Model: ${this.defaultModel}`);
    this.logger.log(`Loaded Vision Model: ${this.visionModel}`);
    this.logger.log(`AI Provider configured for fast responses with optimized settings`);
    const maskedKey = this.apiKey
      ? `${this.apiKey.substring(0, 4)}...${this.apiKey.substring(this.apiKey.length - 4)}`
      : 'None';
    this.logger.log(`Loaded API Key (masked): ${maskedKey}`);
    if (!this.client) {
      this.logger.warn(`[Groq] GROQ_API_KEY is not configured or invalid.`);
    }
  }

  async generateCompletion(
    messages: ChatMessagePayload[],
    requestIdArg?: string,
  ): Promise<AiCompletionResult> {
    const startTime = Date.now();
    const requestId =
      requestIdArg || `req-groq-${Math.random().toString(36).substring(2, 9)}`;
    const promptText = messages.map((m) => m.content).join('\n');
    const estimatedPromptTokens = estimateTokenCount(promptText);

    if (!this.client) {
      this.logger.error(
        `[Groq] Cannot generate completion: Client not initialized.`,
      );
      throw new Error('Groq AI client not initialized (missing API Key)');
    }

    try {
      this.appLogger.logStageTimeline(
        requestId,
        null,
        'GROQ_REQUEST',
        'STARTED',
        0,
        `Dispatching completion request to model: ${this.defaultModel}`,
        { model: this.defaultModel, promptTokens: estimatedPromptTokens },
      );

      const groqMessages = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: groqMessages,
        temperature: 0.2,
      });

      const responseText =
        response.choices[0]?.message?.content || 'No response generated.';
      const executionTimeMs = Date.now() - startTime;
      const promptTokens =
        response.usage?.prompt_tokens || estimatedPromptTokens;
      const completionTokens =
        response.usage?.completion_tokens || estimateTokenCount(responseText);
      const totalTokens =
        response.usage?.total_tokens || promptTokens + completionTokens;

      this.appLogger.logStageTimeline(
        requestId,
        null,
        'GROQ_REQUEST',
        'COMPLETED',
        executionTimeMs,
        'Groq AI Completion Successful',
        {
          model: this.defaultModel,
          promptTokens,
          completionTokens,
          totalTokens,
          latencyMs: executionTimeMs,
          responseSizeBytes: Buffer.byteLength(responseText, 'utf8'),
        },
      );

      return {
        content: responseText,
        model: this.defaultModel,
        promptTokens,
        completionTokens,
        totalTokens,
        executionTimeMs,
        responseSizeBytes: Buffer.byteLength(responseText, 'utf8'),
        status: 'completed',
      };
    } catch (err: any) {
      this.logger.error(`[Groq Error] ${err.message}`, err.stack);
      const executionTimeMs = Date.now() - startTime;

      this.appLogger.logStageTimeline(
        requestId,
        null,
        'GROQ_REQUEST',
        'FAILED',
        executionTimeMs,
        `Groq AI request failed (${err.message}).`,
        { error: err.message, stack: err.stack },
      );
      throw err;
    }
  }

  async *generateStream(
    messages: ChatMessagePayload[],
    requestIdArg?: string,
  ): AsyncGenerator<string, void, unknown> {
    const startTime = Date.now();
    const requestId =
      requestIdArg ||
      `req-groq-str-${Math.random().toString(36).substring(2, 9)}`;

    if (!this.client) {
      throw new Error('Groq AI client not initialized (missing API Key)');
    }

    let tokenCount = 0;
    let firstTokenLogged = false;

    try {
      this.appLogger.logStageTimeline(
        requestId,
        null,
        'STREAMING',
        'STREAM STARTED',
        0,
        `Initiating Groq stream with model: ${this.defaultModel}`,
      );

      const groqMessages = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const stream = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: groqMessages,
        temperature: 0.2,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          if (!firstTokenLogged) {
            firstTokenLogged = true;
            this.appLogger.logStageTimeline(
              requestId,
              null,
              'STREAMING',
              'FIRST TOKEN',
              Date.now() - startTime,
              'First streaming token received from Groq',
              {
                firstTokenLatencyMs: Date.now() - startTime,
              },
            );
          }
          tokenCount++;
          yield content;
        }
      }

      const streamDurationMs = Date.now() - startTime;
      this.appLogger.logStageTimeline(
        requestId,
        null,
        'STREAMING',
        'STREAM COMPLETED',
        streamDurationMs,
        'Stream completed successfully',
        {
          model: this.defaultModel,
          tokenCount,
          streamDurationMs,
        },
      );
    } catch (err: any) {
      const streamDurationMs = Date.now() - startTime;
      this.appLogger.logStageTimeline(
        requestId,
        null,
        'STREAMING',
        'STREAM FAILED',
        streamDurationMs,
        `Groq stream failed (${err.message})`,
        {
          error: err.message,
          stack: err.stack,
        },
      );
      this.logger.error(`[Groq Stream Error] ${err.message}`, err.stack);
      throw err;
    }
  }

  async analyzeImage(
    imageBuffer: Buffer,
    mimeType: string,
    prompt: string,
    requestIdArg?: string,
  ): Promise<string> {
    const requestId =
      requestIdArg ||
      `req-groq-vis-${Math.random().toString(36).substring(2, 9)}`;
    const startTime = Date.now();

    if (!this.client) {
      throw new Error('Groq AI client not initialized (missing API Key)');
    }

    try {
      this.appLogger.logStageTimeline(
        requestId,
        null,
        'GROQ_VISION_REQUEST',
        'STARTED',
        0,
        `Dispatching vision request to model: ${this.visionModel}`,
        { model: this.visionModel },
      );

      const base64Image = imageBuffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64Image}`;

      const response = await this.client.chat.completions.create({
        model: this.visionModel,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: dataUrl,
                },
              },
            ],
          },
        ],
        temperature: 0.2,
      });

      const responseText = response.choices[0]?.message?.content || '';

      this.appLogger.logStageTimeline(
        requestId,
        null,
        'GROQ_VISION_REQUEST',
        'COMPLETED',
        Date.now() - startTime,
        'Groq Vision Analysis Successful',
      );

      return responseText;
    } catch (err: any) {
      this.logger.error(`[Groq Vision Error] ${err.message}`, err.stack);
      this.appLogger.logStageTimeline(
        requestId,
        null,
        'GROQ_VISION_REQUEST',
        'FAILED',
        Date.now() - startTime,
        `Groq Vision request failed (${err.message}).`,
        { error: err.message },
      );
      throw err;
    }
  }

  async checkHealth(): Promise<any> {
    const startTime = Date.now();
    if (!this.client) {
      return {
        status: 'down',
        model: this.defaultModel,
        provider: 'Groq',
        latencyMs: 0,
        streamingSupported: false,
        error: 'No valid GROQ_API_KEY configured',
      };
    }

    try {
      await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
      });
      return {
        status: 'healthy',
        model: this.defaultModel,
        provider: 'Groq',
        latencyMs: Date.now() - startTime,
        streamingSupported: true,
      };
    } catch (err: any) {
      return {
        status: 'down',
        model: this.defaultModel,
        provider: 'Groq',
        latencyMs: Date.now() - startTime,
        streamingSupported: false,
        error: err.message,
      };
    }
  }
}
