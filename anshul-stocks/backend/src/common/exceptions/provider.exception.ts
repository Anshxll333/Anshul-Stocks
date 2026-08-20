import { HttpException, HttpStatus } from '@nestjs/common';

export class ProviderException extends HttpException {
  constructor(
    message: string,
    public readonly providerName?: string,
  ) {
    super(
      {
        success: false,
        error: 'PROVIDER_ERROR',
        providerName,
        message,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
