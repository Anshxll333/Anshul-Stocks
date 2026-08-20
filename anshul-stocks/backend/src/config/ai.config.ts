import { registerAs } from '@nestjs/config';

export interface AiConfig {
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
  maxContextMessages: number;
  maxContextMessageChars: number;
  maxContextUserMessageChars: number;
  maxHistoryBytes: number;
  maxTokens: number;
  temperature: number;
  streamingEnabled: boolean;
  timeoutMs: number;
  visionEnabled: boolean;
}

export default registerAs('ai', (): AiConfig => ({
  apiKey: process.env.OPENAI_API_KEY || '',
  baseUrl:
    process.env.OPENAI_BASE_URL ||
    'https://20128-21dfcfab-7e75-41f0-9533-8ce5e29ecfd1.daytonaproxy01.eu/v1',
  defaultModel: process.env.AI_MODEL || 'mistral/mistral-small-latest',
  maxContextMessages: parseInt(process.env.MAX_CONTEXT_MESSAGES || '4', 10),
  maxContextMessageChars: parseInt(
    process.env.MAX_CONTEXT_MESSAGE_CHARS || '800',
    10,
  ),
  maxContextUserMessageChars: parseInt(
    process.env.MAX_CONTEXT_USER_MESSAGE_CHARS || '400',
    10,
  ),
  maxHistoryBytes: parseInt(process.env.MAX_HISTORY_BYTES || '6000', 10),
  maxTokens: parseInt(process.env.MAX_RESPONSE_TOKENS || '2048', 10),
  temperature: parseFloat(process.env.TEMPERATURE || '0.1'),
  streamingEnabled: true,
  timeoutMs: parseInt(process.env.AI_TIMEOUT_MS || '30000', 10),
  visionEnabled: true,
}));
