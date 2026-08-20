import { MemoryCacheService } from './memory-cache.service';

describe('MemoryCacheService Integration Tests', () => {
  let cache: MemoryCacheService;

  beforeEach(() => {
    cache = new MemoryCacheService();
  });

  it('should store and retrieve value', async () => {
    await cache.set('stock:RELIANCE', { price: 2450 }, 60);
    const cached = await cache.get<{ price: number }>('stock:RELIANCE');
    expect(cached).toEqual({ price: 2450 });
  });

  it('should track hit and miss counters in getStats', async () => {
    await cache.set('key1', 'value1');
    await cache.get('key1'); // Hit
    await cache.get('key2'); // Miss

    const stats = cache.getStats();
    expect(stats.totalKeys).toBe(1);
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hitRatio).toBe(0.5);
  });

  it('should evict expired keys automatically', async () => {
    await cache.set('tempKey', 'tempVal', -1); // Expired TTL
    const val = await cache.get('tempKey');
    expect(val).toBeNull();
  });
});
