import { Logger } from '@nestjs/common';

export type TaskPriority = 'high' | 'normal' | 'low';

export interface QueueItem<T> {
  fn: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
  priority: number;
  retries: number;
  maxRetries: number;
  enqueuedAt: number;
}

export class RequestQueue {
  private readonly logger = new Logger(RequestQueue.name);
  private queue: QueueItem<any>[] = [];
  private isProcessing = false;
  private minDelayMs: number;
  private totalEnqueued = 0;
  private totalCompleted = 0;
  private totalFailed = 0;

  constructor(requestsPerMinute = 8, minDelayMs = 7500) {
    this.minDelayMs = Math.max(
      minDelayMs,
      Math.ceil(60000 / requestsPerMinute),
    );
  }

  public enqueue<T>(
    fn: () => Promise<T>,
    priority: TaskPriority = 'normal',
    maxRetries = 3,
  ): Promise<T> {
    const priorityScore =
      priority === 'high' ? 3 : priority === 'normal' ? 2 : 1;
    this.totalEnqueued++;

    return new Promise<T>((resolve, reject) => {
      const item: QueueItem<T> = {
        fn,
        resolve,
        reject,
        priority: priorityScore,
        retries: 0,
        maxRetries,
        enqueuedAt: Date.now(),
      };

      this.queue.push(item);
      // Sort by priority descending
      this.queue.sort((a, b) => b.priority - a.priority);

      this.processNext();
    });
  }

  private async processNext() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const item = this.queue.shift();

    if (!item) {
      this.isProcessing = false;
      return;
    }

    let wasNonRetryableError = false;
    try {
      const result = await item.fn();
      this.totalCompleted++;
      item.resolve(result);
    } catch (err: any) {
      const isNonRetryable =
        /(400|401|403|404|422|Not Found|Forbidden|Unauthorized|Bad Request|No data found|symbol not found|empty|invalid|unsupported)/i.test(
          err?.message || '' + err,
        );
      if (isNonRetryable) {
        wasNonRetryableError = true;
      }

      if (!isNonRetryable && item.retries < item.maxRetries) {
        item.retries++;
        this.logger.warn(
          `[RequestQueue] Retrying item (${item.retries}/${item.maxRetries}): ${err.message}`,
        );
        this.queue.push(item);
      } else {
        this.totalFailed++;
        item.reject(err);
      }
    } finally {
      const delay = wasNonRetryableError ? 100 : this.minDelayMs;
      setTimeout(() => {
        this.isProcessing = false;
        this.processNext();
      }, delay);
    }
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public clearQueue(): void {
    const remaining = this.queue.length;
    for (const item of this.queue) {
      item.reject(new Error('RequestQueue cleared by system administrator'));
    }
    this.queue = [];
    this.logger.warn(
      `[RequestQueue] Cleared ${remaining} pending queued requests`,
    );
  }

  public getMetrics() {
    return {
      pending: this.queue.length,
      totalEnqueued: this.totalEnqueued,
      totalCompleted: this.totalCompleted,
      totalFailed: this.totalFailed,
      minDelayMs: this.minDelayMs,
    };
  }
}
