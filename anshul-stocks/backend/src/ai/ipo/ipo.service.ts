import { Injectable } from '@nestjs/common';

@Injectable()
export class IpoAiService {
  async analyzeIpoFiling(companyName: string) {
    return {
      companyName,
      status: 'ready_for_sprint_4',
      message: `IPO filing AI analyzer service placeholder for: ${companyName}`,
    };
  }
}
