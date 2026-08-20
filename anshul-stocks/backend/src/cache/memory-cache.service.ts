import { Injectable, Logger } from '@nestjs/common';
import { ICacheService } from './cache.interface';

interface CacheEntry<T> {
  value: T;
  createdAt: number;
  expiresAt: number | null;
}

export interface CacheStats {
  totalKeys: number;
  hits: number;
  misses: number;
  hitRatio: number;
  memoryUsageEstimateBytes: number;
}

@Injectable()
export class MemoryCacheService implements ICacheService {
  private readonly logger = new Logger(MemoryCacheService.name);
  private store = new Map<string, CacheEntry<any>>();
  private hits = 0;
  private misses = 0;

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      this.logger.debug(`[Cache] Miss for key: ${key}`);
      return null;
    }

    const ageSeconds = Math.round((Date.now() - entry.createdAt) / 1000);

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.misses++;
      this.store.delete(key);
      this.logger.debug(
        `[Cache] Expired key evicted: ${key} (age: ${ageSeconds}s)`,
      );
      return null;
    }

    this.hits++;
    this.logger.debug(`[Cache] Hit for key: ${key} (age: ${ageSeconds}s)`);
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.store.set(key, { value, createdAt: Date.now(), expiresAt });
    this.logger.debug(
      `[Cache] Set key: ${key} (ttl: ${ttlSeconds || 'indefinite'}s)`,
    );
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    const val = await this.get(key);
    return val !== null;
  }

  async mget<T>(keys: string[]): Promise<Record<string, T | null>> {
    const result: Record<string, T | null> = {};
    for (const key of keys) {
      result[key] = await this.get<T>(key);
    }
    return result;
  }

  async mset<T>(
    entries: Record<string, T>,
    ttlSeconds?: number,
  ): Promise<void> {
    for (const [key, val] of Object.entries(entries)) {
      await this.set(key, val, ttlSeconds);
    }
  }

  async reset(): Promise<void> {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
    this.logger.log('[Cache] Memory store reset successfully');
  }

  getStats(): CacheStats {
    const totalRequests = this.hits + this.misses;
    const hitRatio =
      totalRequests > 0 ? Number((this.hits / totalRequests).toFixed(4)) : 1.0;
    let estimatedBytes = 0;
    for (const [key, entry] of this.store.entries()) {
      estimatedBytes += Buffer.byteLength(key, 'utf8');
      try {
        estimatedBytes += Buffer.byteLength(
          JSON.stringify(entry.value),
          'utf8',
        );
      } catch {
        estimatedBytes += 100;
      }
    }

    return {
      totalKeys: this.store.size,
      hits: this.hits,
      misses: this.misses,
      hitRatio,
      memoryUsageEstimateBytes: estimatedBytes,
    };
  }
}
