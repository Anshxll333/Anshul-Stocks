import { Injectable } from '@nestjs/common';

@Injectable()
export class AiService {
  async askMentor(query: string) {
    return {
      success: true,
      message: 'AI Mentor query placeholder (Sprint 2 integration)',
      data: `Received query: "${query}"`,
    };
  }
}
