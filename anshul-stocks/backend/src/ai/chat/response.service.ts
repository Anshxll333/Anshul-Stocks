import { Injectable } from '@nestjs/common';

@Injectable()
export class ResponseService {
  formatMarkdownResponse(rawText: string, metadata?: any) {
    return {
      formattedContent: rawText,
      metadata: metadata || { formattedAt: new Date().toISOString() },
    };
  }
}
