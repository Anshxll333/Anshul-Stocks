import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DRIZZLE_CONNECTION } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { newsArticles, providerCache } from '../../database/schema';
import { eq, and, gt } from 'drizzle-orm';
import { NewsProvider } from '../news.provider';
import { NewsArticleDTO } from '../dto/news-article.dto';
import { ProviderManager } from '../provider.manager';
import { NewsMapper } from '../mappers/news.mapper';

@Injectable()
export class NewsSyncService {
  private readonly logger = new Logger(NewsSyncService.name);
  private readonly cacheTtlSeconds: number;

  constructor(
    @Inject(DRIZZLE_CONNECTION) private readonly db: DrizzleDB,
    private readonly newsProvider: NewsProvider,
    private readonly providerManager: ProviderManager,
    private readonly configService: ConfigService,
  ) {
    this.cacheTtlSeconds =
      this.configService.get<number>('provider.cacheTtlSeconds') || 3600;
  }

  async syncNews(query?: string): Promise<NewsArticleDTO[]> {
    const topic = (query || 'MARKET').toUpperCase();
    const cacheKey = `news_${topic}`;
    const now = new Date();

    // 1. Check PostgreSQL cache first
    try {
      const [cached] = await this.db
        .select()
        .from(providerCache)
        .where(
          and(
            eq(providerCache.cacheKey, cacheKey),
            gt(providerCache.expiresAt, now),
          ),
        );

      if (cached && cached.payload) {
        this.logger.log(`[NewsSyncService] Cache HIT for news ${topic}`);
        return JSON.parse(cached.payload);
      }
    } catch (err) {
      // Non-blocking catch
    }

    this.logger.log(
      `[NewsSyncService] Cache MISS for news ${topic}. Fetching via ProviderManager.`,
    );

    // 2. Fetch live data through ProviderManager with fallback
    const rawArticles = await this.providerManager.executeRequest(
      'TwelveData-News',
      `/news?topic=${topic}`,
      async () => {
        return this.newsProvider.getLatestNews(topic, 5);
      },
      async () => {
        return [];
      },
    );

    const validArticles: NewsArticleDTO[] = (rawArticles || []).filter(
      (item): item is NewsArticleDTO => item !== null,
    );

    // 3. Save to PostgreSQL cache and database table
    try {
      const expiresAt = new Date(Date.now() + this.cacheTtlSeconds * 1000);

      await this.db
        .insert(providerCache)
        .values({
          cacheKey,
          providerSource: 'TwelveData-News',
          payload: JSON.stringify(validArticles),
          fetchedAt: now,
          expiresAt,
          status: 'valid',
        })
        .onConflictDoNothing();

      for (const item of validArticles) {
        await this.db
          .insert(newsArticles)
          .values({
            headline: item.headline,
            summary: item.summary || null,
            source: item.source,
            url: item.url || null,
            publishedAt: new Date(item.publishedAt),
            symbols: JSON.stringify(item.symbols),
            sentiment: item.sentiment,
          })
          .onConflictDoNothing();
      }
    } catch (err) {
      // Non-blocking catch
    }

    return validArticles;
  }
}
