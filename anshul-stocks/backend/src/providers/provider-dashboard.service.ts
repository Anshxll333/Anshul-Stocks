import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../database/database.module';
import type { DrizzleDB } from '../database/database.module';
import { providerRequests } from '../database/schema';
import { desc } from 'drizzle-orm';

export interface ProviderDashboardStats {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  timeoutCount: number;
  successPercentage: number;
  failurePercentage: number;
  averageLatencyMs: number;
  topEndpoints: { endpoint: string; count: number }[];
  recentRequests: any[];
}

@Injectable()
export class ProviderDashboardService {
  constructor(@Inject(DRIZZLE_CONNECTION) private readonly db: DrizzleDB) {}

  async getDashboardMetrics(): Promise<ProviderDashboardStats> {
    const logs = await this.db
      .select()
      .from(providerRequests)
      .orderBy(desc(providerRequests.timestamp))
      .limit(100);

    const total = logs.length;
    if (total === 0) {
      return {
        totalRequests: 0,
        successCount: 0,
        failureCount: 0,
        timeoutCount: 0,
        successPercentage: 100,
        failurePercentage: 0,
        averageLatencyMs: 0,
        topEndpoints: [],
        recentRequests: [],
      };
    }

    const successCount = logs.filter(
      (l) => l.status === 'success' || l.status === 'fallback_success',
    ).length;
    const failureCount = logs.filter((l) => l.status === 'error').length;
    const timeoutCount = logs.filter((l) => l.status === 'timeout').length;
    const totalLatency = logs.reduce((acc, l) => acc + (l.latencyMs || 0), 0);

    const endpointCounts: Record<string, number> = {};
    logs.forEach((l) => {
      endpointCounts[l.endpoint] = (endpointCounts[l.endpoint] || 0) + 1;
    });

    const topEndpoints = Object.entries(endpointCounts)
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalRequests: total,
      successCount,
      failureCount,
      timeoutCount,
      successPercentage: Number(((successCount / total) * 100).toFixed(2)),
      failurePercentage: Number(((failureCount / total) * 100).toFixed(2)),
      averageLatencyMs: Number((totalLatency / total).toFixed(2)),
      topEndpoints,
      recentRequests: logs.slice(0, 10),
    };
  }
}
