import { Injectable } from '@nestjs/common';

@Injectable()
export class ConversationAiService {
  async getActiveSession(sessionId: string) {
    return {
      sessionId,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
  }
}
