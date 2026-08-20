import { Injectable } from '@nestjs/common';
import { UploadException } from '../../common/exceptions/upload.exception';

@Injectable()
export class FileValidatorService {
  private readonly allowedMimeTypes = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
  ];
  private readonly maxSizeBytes = 10 * 1024 * 1024; // 10MB limit

  validate(file: { mimetype: string; size: number; originalname: string }) {
    if (!file) {
      throw new UploadException('No file payload attached');
    }
    if (!this.allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
      throw new UploadException(
        `Unsupported MIME type: ${file.mimetype}. Allowed: PNG, JPEG, JPG, WEBP.`,
      );
    }
    if (file.size > this.maxSizeBytes) {
      throw new UploadException(
        `File size exceeds 10MB limit. Uploaded: ${(file.size / (1024 * 1024)).toFixed(2)}MB`,
      );
    }
    return true;
  }
}
