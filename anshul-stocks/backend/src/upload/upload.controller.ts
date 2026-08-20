import {
  Controller,
  Get,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadScreenshot(
    @UploadedFile() file: any,
    @Body('conversationId') conversationId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No image file uploaded');
    }
    const convId = conversationId ? parseInt(conversationId, 10) : undefined;
    const record = await this.uploadService.saveFileRecord(file, 1, convId);
    return {
      success: true,
      message:
        'Screenshot uploaded successfully. Prepared for AI OCR & Screenshot analysis.',
      data: record,
    };
  }

  @Get()
  async getUploads() {
    const records = await this.uploadService.getUserUploads(1);
    return { success: true, data: records };
  }

  @Get('analyses')
  async getRecentAnalyses() {
    const records = await this.uploadService.getRecentAnalyses(1);
    return { success: true, data: records };
  }
}
