import { Module } from '@nestjs/common';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { FileValidatorService } from './validation/file-validator.service';
import { FileStorageService } from './storage/file-storage.service';
import { FileProcessorService } from './processing/file-processor.service';
import { FilePreviewService } from './preview/file-preview.service';

@Module({
  controllers: [UploadController],
  providers: [
    UploadService,
    FileValidatorService,
    FileStorageService,
    FileProcessorService,
    FilePreviewService,
  ],
  exports: [
    UploadService,
    FileValidatorService,
    FileStorageService,
    FileProcessorService,
    FilePreviewService,
  ],
})
export class UploadModule {}
