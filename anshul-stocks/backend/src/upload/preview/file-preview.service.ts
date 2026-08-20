import { Injectable } from '@nestjs/common';

@Injectable()
export class FilePreviewService {
  generatePreviewMetadata(filepath: string) {
    return {
      filepath,
      thumbnailUrl: null,
      dimensions: { width: 1920, height: 1080 },
    };
  }
}
