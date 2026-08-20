import { Injectable } from '@nestjs/common';

@Injectable()
export class MemoryService {
  async getShortTermMemory(conversationId: number) {
    return {
      conversationId,
      recentTurns: [],
      summary: 'Placeholder short term conversation memory buffer.',
    };
  }
}
