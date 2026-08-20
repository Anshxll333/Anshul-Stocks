export interface ChatMessagePayload {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiCompletionResult {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  executionTimeMs: number;
  responseSizeBytes: number;
  status: 'completed' | 'fallback' | 'failed';
}

export interface IAiProvider {
  generateCompletion(
    messages: ChatMessagePayload[],
    requestIdArg?: string,
  ): Promise<AiCompletionResult>;
  generateStream(
    messages: ChatMessagePayload[],
    requestIdArg?: string,
  ): AsyncGenerator<string, void, unknown>;
  analyzeImage(
    imageBuffer: Buffer,
    mimeType: string,
    prompt: string,
    requestIdArg?: string,
  ): Promise<string>;
  checkHealth(): Promise<any>;
}
