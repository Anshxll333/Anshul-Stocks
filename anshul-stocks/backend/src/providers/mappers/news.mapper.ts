import { NewsArticleDTO } from '../dto/news-article.dto';

export class NewsMapper {
  static toArticleDTO(
    raw: any,
    defaultTopic: string = 'MARKET',
  ): NewsArticleDTO | null {
    if (!raw || (!raw.headline && !raw.title)) return null;

    return {
      id: raw.id || `news-${Math.random().toString(36).substring(2, 9)}`,
      headline: raw.headline || raw.title,
      summary: raw.summary || raw.description || (null as any),
      source: raw.source || raw.provider || 'Financial News Wire',
      url: raw.url || (null as any),
      publishedAt: raw.publishedAt
        ? new Date(raw.publishedAt).toISOString()
        : new Date().toISOString(),
      symbols: Array.isArray(raw.symbols) ? raw.symbols : [defaultTopic],
      sentiment: raw.sentiment || 'neutral',
    };
  }

  static toArticleList(
    rawArray: any[],
    defaultTopic: string = 'MARKET',
  ): NewsArticleDTO[] {
    if (!Array.isArray(rawArray) || rawArray.length === 0) return [];
    return rawArray
      .map((item) => NewsMapper.toArticleDTO(item, defaultTopic))
      .filter((item): item is NewsArticleDTO => item !== null);
  }
}
