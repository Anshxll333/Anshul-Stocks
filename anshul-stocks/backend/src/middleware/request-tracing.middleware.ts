import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestTracingMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    let requestId = req.headers['x-request-id'] as string;
    if (!requestId) {
      requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      req.headers['x-request-id'] = requestId;
    }
    res.setHeader('X-Request-ID', requestId);
    next();
  }
}
