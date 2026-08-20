import { HttpException, HttpStatus } from '@nestjs/common';

export class ValidationException extends HttpException {
  constructor(
    message: string,
    public readonly validationErrors?: any,
  ) {
    super(
      {
        success: false,
        error: 'VALIDATION_ERROR',
        message,
        validationErrors,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
