import { Injectable } from '@nestjs/common';

@Injectable()
export class FileProcessorService {
  async processFile(filepath: string, mimeType: string) {
    return {
      filepath,
      mimeType,
      processingStatus: 'completed',
      ocrPipeline: 'ready_sprint_4',
      checksum: 'sha256-placeholder-checksum',
    };
  }
}
