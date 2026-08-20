import { HttpException, HttpStatus } from '@nestjs/common';

export class UploadException extends HttpException {
  constructor(
    message: string,
    public readonly details?: any,
  ) {
    super(
      {
        success: false,
        error: 'UPLOAD_ERROR',
        message,
        details,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
