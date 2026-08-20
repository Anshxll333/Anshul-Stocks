import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class FileStorageService {
  private readonly uploadDir = path.join(process.cwd(), 'uploads');

  constructor() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  getDestinationPath(filename: string): string {
    return path.join(this.uploadDir, filename);
  }

  async exists(filepath: string): Promise<boolean> {
    return fs.existsSync(filepath);
  }
}
