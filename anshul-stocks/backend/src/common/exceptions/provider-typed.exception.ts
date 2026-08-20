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

export class ProviderTimeoutException extends ProviderException {
  constructor(message: string, providerName?: string) {
    super(`Timeout: ${message}`, providerName);
  }
}

export class ProviderRateLimitException extends ProviderException {
  constructor(message: string, providerName?: string) {
    super(`Rate Limit Exceeded: ${message}`, providerName);
  }
}

export class ProviderValidationException extends ProviderException {
  constructor(message: string, providerName?: string) {
    super(`Validation Error: ${message}`, providerName);
  }
}

export class CacheException extends ProviderException {
  constructor(message: string) {
    super(`Cache Error: ${message}`, 'PostgreSQLCache');
  }
}

export class MapperException extends ProviderException {
  constructor(message: string) {
    super(`Mapper Error: ${message}`, 'NormalizationLayer');
  }
}
