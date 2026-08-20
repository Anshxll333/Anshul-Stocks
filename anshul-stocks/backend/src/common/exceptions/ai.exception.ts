import { HttpException, HttpStatus } from '@nestjs/common';

export class AIException extends HttpException {
  constructor(
    message: string,
    public readonly details?: any,
  ) {
    super(
      {
        success: false,
        error: 'AI_AGENT_ERROR',
        message,
        details,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.BAD_GATEWAY,
    );
  }
}
