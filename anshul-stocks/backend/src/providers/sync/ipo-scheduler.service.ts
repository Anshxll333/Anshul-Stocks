import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IpoSyncService } from './ipo-sync.service';

/**
 * Hourly automatic IPO synchronization job.
 *
 * - Runs once every hour using @nestjs/schedule (EVERY_HOUR = "0 * * * *").
 * - Fetches ALL IPOs from FinAPI (one request per hour), maps them through the
 *   existing IPOMapper and UPSERTs them into the `ipo_data` table.
 * - On boot it triggers an initial sync shortly after startup so the frontend
 *   has fresh data without waiting for the first cron tick.
 *
 * Rate limiting: the cron is the ONLY caller of `IpoSyncService.syncIpos()` in
 * production. The frontend reads from PostgreSQL via GET /market/ipo and never
 * hits FinAPI directly.
 */
@Injectable()
export class IpoSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(IpoSchedulerService.name);

  constructor(private readonly ipoSyncService: IpoSyncService) {}

  async onModuleInit(): Promise<void> {
    // Initial sync 10s after boot. Delayed + fire-and-forget so a FinAPI outage
    // can never block or crash NestJS startup.
    const timer = setTimeout(() => {
      this.runSync().catch(() => {
        /* handled inside runSync */
      });
    }, 10_000);
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
  }

  @Cron(CronExpression.EVERY_HOUR, { name: 'ipo-automatic-sync' })
  async handleHourlyIpoSync(): Promise<void> {
    await this.runSync();
  }

  private async runSync(): Promise<void> {
    try {
      const result = await this.ipoSyncService.syncIpos();
      if (result.status === 'failed') {
        this.logger.error(
          `[IPO SYNC] Scheduled run failed: ${result.error || 'unknown error'}`,
        );
        return;
      }
      this.logger.log(
        `[IPO SYNC] Scheduled run finished | status=${result.status} fetched=${result.fetched} inserted=${result.inserted} updated=${result.updated} gmpUpdated=${result.gmpUpdated} subscriptionUpdated=${result.subscriptionUpdated}`,
      );
    } catch (err: any) {
      // Absolute safety net: the cron must never crash the process.
      this.logger.error(
        `[IPO SYNC] Unexpected scheduler error: ${err?.message || err}`,
      );
    }
  }
}
