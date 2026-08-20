export interface ToolMetadata {
  name: string;
  description: string;
  parametersSchema: Record<string, any>;
}

export interface ToolResult<T = any> {
  success: boolean;
  toolName: string;
  data: T;
  executionTimeMs: number;
  error?: string;
}

export interface ITool<TInput = any, TOutput = any> {
  readonly metadata: ToolMetadata;
  execute(input: TInput): Promise<ToolResult<TOutput>>;
}
