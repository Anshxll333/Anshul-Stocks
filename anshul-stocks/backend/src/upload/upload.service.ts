import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../database/database.module';
import type { DrizzleDB } from '../database/database.module';
import { uploadedFiles, analysisHistory } from '../database/schema';
import { eq, desc } from 'drizzle-orm';
import { FileValidatorService } from './validation/file-validator.service';
import { FileStorageService } from './storage/file-storage.service';
import { FileProcessorService } from './processing/file-processor.service';
import { FilePreviewService } from './preview/file-preview.service';
import * as path from 'path';

@Injectable()
export class UploadService {
  constructor(
    @Inject(DRIZZLE_CONNECTION) private readonly db: DrizzleDB,
    private readonly validator: FileValidatorService,
    private readonly storage: FileStorageService,
    private readonly processor: FileProcessorService,
    private readonly preview: FilePreviewService,
  ) {}

  async saveFileRecord(
    file: {
      filename?: string;
      originalname: string;
      mimetype: string;
      size: number;
      path?: string;
      buffer?: Buffer;
    },
    userId: number = 1,
    conversationId?: number,
  ) {
    this.validator.validate(file);
    const resolvedPath =
      file.path ||
      `/uploads/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const processed = await this.processor.processFile(
      resolvedPath,
      file.mimetype,
    );
    const previewMeta = this.preview.generatePreviewMetadata(resolvedPath);

    const [record] = await this.db
      .insert(uploadedFiles)
      .values({
        userId,
        conversationId: conversationId || null,
        filename: file.filename || path.basename(resolvedPath),
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileType: 'screenshot',
        processingStatus: 'processed',
        width: previewMeta.dimensions.width,
        height: previewMeta.dimensions.height,
        checksum: processed.checksum,
        sizeBytes: file.size,
        filepath: resolvedPath,
        metadata: JSON.stringify({
          uploadedAt: new Date().toISOString(),
          ocrStatus: 'ready_for_vision_ai',
        }),
      })
      .returning();

    await this.db.insert(analysisHistory).values({
      userId,
      fileId: record.id,
      conversationId: conversationId || null,
      analysisType: 'screenshot_analysis',
      input: `Uploaded file: ${file.originalname}`,
      output: 'Prepared for Vision OCR Analysis',
      result: JSON.stringify({
        status: 'queued',
        message: 'File pipeline processed. Vision AI analysis prepared.',
      }),
      confidence: '0.95',
      processingTime: 120,
      model: 'vision-ai-pipeline',
      status: 'completed',
    });

    return record;
  }

  async getUserUploads(userId: number = 1) {
    return this.db
      .select()
      .from(uploadedFiles)
      .where(eq(uploadedFiles.userId, userId))
      .orderBy(desc(uploadedFiles.createdAt));
  }

  async getRecentAnalyses(userId: number = 1) {
    return this.db
      .select()
      .from(analysisHistory)
      .where(eq(analysisHistory.userId, userId))
      .orderBy(desc(analysisHistory.createdAt));
  }
}
