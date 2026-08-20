import { Injectable } from '@nestjs/common';

@Injectable()
export class StreamService {
  async createStreamResponse(content: string) {
    return {
      streamType: 'SSE',
      chunks: [content],
      completed: true,
    };
  }
}
