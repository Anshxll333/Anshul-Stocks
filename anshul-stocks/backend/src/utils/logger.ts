import { LoggerService, Injectable, Scope } from '@nestjs/common';

export interface StructuredLogPayload {
  requestId?: string;
  conversationId?: number | null;
  correlationId?: string;
  serviceName?: string;
  executionTimeMs?: number;
  stage?: string;
  status?: string;
  severity?: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'VERBOSE';
  message: string;
  data?: any;
}

@Injectable({ scope: Scope.TRANSIENT })
export class AppLogger implements LoggerService {
  private serviceName = 'AnshulStocksBackend';

  setServiceName(name: string) {
    this.serviceName = name;
  }

  setContext(context: string) {
    this.serviceName = context;
  }

  logStructured(payload: StructuredLogPayload) {
    const formatted = {
      timestamp: new Date().toISOString(),
      requestId:
        payload.requestId ||
        `req-${Math.random().toString(36).substring(2, 9)}`,
      conversationId: payload.conversationId ?? null,
      correlationId:
        payload.correlationId ||
        `corr-${Math.random().toString(36).substring(2, 9)}`,
      serviceName: payload.serviceName || this.serviceName,
      executionTimeMs: payload.executionTimeMs || 0,
      stage: payload.stage || 'GENERAL',
      status: payload.status || 'SUCCESS',
      severity: payload.severity || 'INFO',
      message: payload.message,
      data: payload.data || null,
    };
    console.log(JSON.stringify(formatted));
  }

  logStageTimeline(
    requestId: string,
    conversationId: number | null,
    stage: string,
    status: string,
    executionTimeMs: number,
    message: string,
    data?: any,
  ) {
    this.logStructured({
      requestId,
      conversationId,
      stage,
      status,
      executionTimeMs,
      severity: status === 'FAILED' ? 'ERROR' : 'INFO',
      message: `[TIMELINE] [${stage}] -> ${message}`,
      data,
    });
  }

  log(message: any, context?: string) {
    this.logStructured({
      serviceName: context || this.serviceName,
      severity: 'INFO',
      message: typeof message === 'string' ? message : JSON.stringify(message),
    });
  }

  error(message: any, trace?: string, context?: string) {
    this.logStructured({
      serviceName: context || this.serviceName,
      severity: 'ERROR',
      status: 'FAILED',
      message: typeof message === 'string' ? message : JSON.stringify(message),
      data: { trace },
    });
  }

  warn(message: any, context?: string) {
    this.logStructured({
      serviceName: context || this.serviceName,
      severity: 'WARN',
      message: typeof message === 'string' ? message : JSON.stringify(message),
    });
  }

  debug(message: any, context?: string) {
    this.logStructured({
      serviceName: context || this.serviceName,
      severity: 'DEBUG',
      message: typeof message === 'string' ? message : JSON.stringify(message),
    });
  }

  verbose(message: any, context?: string) {
    this.logStructured({
      serviceName: context || this.serviceName,
      severity: 'VERBOSE',
      message: typeof message === 'string' ? message : JSON.stringify(message),
    });
  }
}
