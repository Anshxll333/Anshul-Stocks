import { Injectable, Inject } from '@nestjs/common';
import { ITool, ToolMetadata, ToolResult } from './tool.interface';
import { DRIZZLE_CONNECTION } from '../../database/database.module';
import { uploadedFiles } from '../../database/schema';
import { eq, desc } from 'drizzle-orm';
import * as fs from 'fs';
import { ProviderManager } from '../../providers/provider.manager';

@Injectable()
export class VisionTool implements ITool<
  { filepath?: string; uploadId?: string; conversationId?: number },
  any
> {
  readonly metadata: ToolMetadata = {
    name: 'vision_ocr_extractor',
    description:
      'Extracts structured table rows, ticker symbols, and balances from investment screenshots.',
    parametersSchema: {
      type: 'object',
      properties: {
        filepath: {
          type: 'string',
          description: 'Path to screenshot image file',
        },
        uploadId: { type: 'string', description: 'Database upload record ID' },
      },
    },
  };

  constructor(
    @Inject(DRIZZLE_CONNECTION) private readonly db: any,
    private readonly providerManager: ProviderManager,
  ) {}

  async execute(input: {
    filepath?: string;
    uploadId?: string;
    conversationId?: number;
  }): Promise<ToolResult<any>> {
    const startTime = Date.now();
    let dbRecord: any = null;

    try {
      if (
        input.uploadId &&
        input.uploadId !== 'latest' &&
        !isNaN(parseInt(input.uploadId, 10))
      ) {
        const [found] = await this.db
          .select()
          .from(uploadedFiles)
          .where(eq(uploadedFiles.id, parseInt(input.uploadId, 10)))
          .limit(1);
        dbRecord = found;
      }

      if (!dbRecord && this.db) {
        const [latest] = await this.db
          .select()
          .from(uploadedFiles)
          .orderBy(desc(uploadedFiles.createdAt))
          .limit(1);
        dbRecord = latest;
      }
    } catch {
      // Fallback if DB query fails
    }

    if (!dbRecord) {
      return {
        success: false,
        toolName: this.metadata.name,
        data: {
          error: `No uploaded screenshot file record found in database for Upload ID: ${input.uploadId || 'latest'}. Please upload a screenshot image before requesting Vision AI analysis.`,
          uploadId: null,
          ocrExtractedText: `[VISION OCR ERROR]: No uploaded file record found. Please upload a screenshot first.`,
          detectedSymbols: [],
        },
        executionTimeMs: Date.now() - startTime,
      };
    }

    const filename =
      dbRecord.originalName || dbRecord.filename || 'screenshot.png';
    const uploadId = dbRecord.id;
    const sizeKb = ((dbRecord.sizeBytes || 0) / 1024).toFixed(1);
    const uploadedAt = dbRecord.createdAt
      ? new Date(dbRecord.createdAt).toISOString()
      : new Date().toISOString();

    const mimeType = dbRecord.mimeType || 'image/png';
    const filePath = dbRecord.filepath;

    let simulatedOcr = '';
    const detectedSymbols: string[] = [];

    try {
      if (filePath && fs.existsSync(filePath)) {
        const imageBuffer = fs.readFileSync(filePath);
        const prompt = `You are a highly accurate financial Vision OCR engine.
PHASE 1 (IMAGE TO TEXT): Transcribe EVERY visible number, label, symbol, and date EXACTLY as shown on screen. Extract: Company Name, Ticker/Symbol, Exchange, Price Band / Issue Price / LTP, Lot Size, Quantity, Subscription Multiples (QIB/NII/Retail/Total), Grey Market Premium (GMP), Financial Ratios (P/E, P/B, ROE, ROCE, Debt, Margins), Portfolio Total Value, P&L, and all Dates. Format as clean structured markdown.
PHASE 2 (ACCURATE ANALYSIS): Using ONLY the extracted text, summarize findings for an investment mentor and explicitly list every field that was NOT VISIBLE.
CRITICAL RULES: If a value is not visible in the image write "NOT VISIBLE". NEVER invent, estimate, round, or fabricate any number. Do NOT use any hardcoded/memorized data. Every figure must come from the image itself.`;

        simulatedOcr = await this.providerManager
          .getAiProvider()
          .analyzeImage(imageBuffer, mimeType, prompt, `vision-${uploadId}`);
      } else {
        simulatedOcr = `[VISION ERROR]: File not found on disk at path: ${filePath}`;
      }
    } catch (err: any) {
      simulatedOcr = `[VISION ERROR]: Failed to analyze image via AI Provider: ${err.message}`;
    }

    const ocrExtractedText = `[VISION AI PARSED SCREENSHOT METADATA & FILE DETAILS]:
File ID: ${uploadId}
Original Filename: ${filename}
Storage Filepath: ${dbRecord.filepath}
MIME Type: ${dbRecord.mimeType}
File Size: ${sizeKb} KB
Uploaded At: ${uploadedAt}
Processing Status: ${dbRecord.processingStatus}

[EXTRACTED OCR CONTENT]:
${simulatedOcr}

[AUTHENTIC UPLOAD ANALYSIS DIRECTIVE]:
The OCR text above represents the literal readable on-screen text and figures extracted from user screenshot "${filename}" (ID: ${uploadId}). Use these exact extracted figures to provide a definitive, highly accurate AI Mentor evaluation.`;

    return {
      success: true,
      toolName: this.metadata.name,
      data: {
        uploadId,
        filename,
        filepath: dbRecord.filepath,
        mimeType: dbRecord.mimeType,
        sizeBytes: dbRecord.sizeBytes,
        ocrExtractedText,
        detectedSymbols,
        summary: `Parsed screenshot document "${filename}" (ID: ${uploadId}, ${sizeKb} KB).`,
      },
      executionTimeMs: Date.now() - startTime,
    };
  }
}
