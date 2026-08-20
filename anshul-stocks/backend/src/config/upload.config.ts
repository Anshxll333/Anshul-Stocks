import { registerAs } from '@nestjs/config';

export interface UploadConfig {
  maxSizeBytes: number;
  allowedMimeTypes: string[];
  uploadDirectory: string;
  enableOcrPreprocessing: boolean;
}

export default registerAs('upload', (): UploadConfig => ({
  maxSizeBytes: parseInt(process.env.MAX_UPLOAD_SIZE || '10485760', 10), // 10MB default
  allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
  uploadDirectory: process.env.UPLOAD_DIR || 'uploads',
  enableOcrPreprocessing: true,
}));
