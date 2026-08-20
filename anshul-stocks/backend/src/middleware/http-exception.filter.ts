import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppLogger } from '../utils/logger';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new AppLogger();

  constructor() {
    this.logger.setContext('GlobalExceptionFilter');
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal Server Error';
    let errors: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resContent = exception.getResponse();

      if (typeof resContent === 'object' && resContent !== null) {
        message = (resContent as any).message || exception.message;
        errors =
          (resContent as any).error || (resContent as any).errors || null;
      } else {
        message = exception.message || String(resContent);
      }
    } else if (exception instanceof Error) {
      // General Javascript errors or database issues
      message = exception.message;

      // Determine status based on database error types if needed (e.g. PostgreSQL duplicate keys)
      if (
        exception.message.includes('unique constraint') ||
        exception.message.includes('duplicate key')
      ) {
        status = HttpStatus.CONFLICT;
        message = 'Database Conflict: Resource already exists';
      } else if (exception.message.includes('foreign key constraint')) {
        status = HttpStatus.BAD_REQUEST;
        message =
          'Database Integrity Violation: Referenced entity does not exist';
      }
    }

    this.logger.error(
      `Exception on ${request.method} ${request.url}: ${message}`,
      exception instanceof Error ? exception.stack : '',
    );

    response.status(status).json({
      success: false,
      statusCode: status,
      message: Array.isArray(message) ? message[0] : message,
      errors: Array.isArray(message) ? message : errors,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
