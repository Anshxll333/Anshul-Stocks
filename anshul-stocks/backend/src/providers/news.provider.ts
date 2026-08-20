import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NewsArticleDTO } from './dto/news-article.dto';
import { NewsMapper } from './mappers/news.mapper';
import { ProviderException } from '../common/exceptions/provider-typed.exception';
import { fetchWithTimeout } from '../utils/fetch-timeout';

@Injectable()
export class NewsProvider {
  private readonly logger = new Logger(NewsProvider.name);
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey =
      this.configService.get<string>('TWELVE_DATA_API_KEY') ||
      process.env.TWELVE_DATA_API_KEY ||
      '';
  }

  async getLatestNews(
    query?: string,
    limit: number = 5,
  ): Promise<NewsArticleDTO[]> {
    if (!this.apiKey) {
      throw new ProviderException(
        'TWELVE_DATA_API_KEY environment variable is required',
        'NewsProvider',
      );
    }

    const topic = query ? query.toUpperCase() : 'MARKET';

    try {
      const url = `https://api.twelvedata.com/news?symbol=${topic}&limit=${limit}&apikey=${this.apiKey}`;
      const res = await fetchWithTimeout(url, {}, 5000);

      if (res.ok) {
        const data = await res.json();
        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
          return NewsMapper.toArticleList(data.data, topic);
        }
      }
    } catch (err: any) {
      this.logger.warn(
        `[NewsProvider] News API fetch failed for ${topic}: ${err.message}`,
      );
    }

    // Strict return empty array if no articles return from API
    return [];
  }
}
