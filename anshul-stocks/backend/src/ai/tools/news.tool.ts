import { Injectable } from '@nestjs/common';
import { ITool, ToolMetadata, ToolResult } from './tool.interface';
import { NewsSyncService } from '../../providers/sync/news-sync.service';

@Injectable()
export class NewsTool implements ITool<{ topic?: string }, any> {
  constructor(private readonly newsSyncService: NewsSyncService) {}

  readonly metadata: ToolMetadata = {
    name: 'financial_news_fetcher',
    description:
      'Retrieves latest financial news headlines, source, summary, publication date, and sentiment.',
    parametersSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Stock symbol or sector topic' },
      },
    },
  };

  async execute(input: { topic?: string }): Promise<ToolResult<any>> {
    const startTime = Date.now();
    const articles = await this.newsSyncService.syncNews(input.topic);

    return {
      success: true,
      toolName: this.metadata.name,
      data: {
        topic: input.topic || 'MARKET',
        totalArticles: articles.length,
        articles,
      },
      executionTimeMs: Date.now() - startTime,
    };
  }
}
