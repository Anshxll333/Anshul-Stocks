export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  mget<T>(keys: string[]): Promise<Record<string, T | null>>;
  mset<T>(entries: Record<string, T>, ttlSeconds?: number): Promise<void>;
  reset(): Promise<void>;
}

export const CACHE_SERVICE_TOKEN = 'CACHE_SERVICE_TOKEN';
