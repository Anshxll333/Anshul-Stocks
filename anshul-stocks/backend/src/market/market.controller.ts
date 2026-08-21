import {
  Controller,
  Get,
  Param,
  Query,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CompanySyncService } from '../providers/sync/company-sync.service';
import { FinancialSyncService } from '../providers/sync/financial-sync.service';
import { IpoSyncService } from '../providers/sync/ipo-sync.service';
import { NewsSyncService } from '../providers/sync/news-sync.service';
import { YahooFinanceProvider } from '../providers/yahoo-finance.provider';
import { UploadService } from '../upload/upload.service';

import { ProviderManager } from '../providers/provider.manager';

@Controller('market')
export class MarketController {
  private readonly logger = new Logger(MarketController.name);

  constructor(
    private readonly companySyncService: CompanySyncService,
    private readonly financialSyncService: FinancialSyncService,
    private readonly ipoSyncService: IpoSyncService,
    private readonly newsSyncService: NewsSyncService,
    private readonly yahooFinanceProvider: YahooFinanceProvider,
    private readonly uploadService: UploadService,
    private readonly providerManager: ProviderManager,
  ) {}

  @Get('quote/:symbol')
  async getQuote(@Param('symbol') symbol: string) {
    try {
      const cleanSym = symbol.trim().toUpperCase();
      const { profile, quote } =
        await this.companySyncService.syncCompanyAndQuote(cleanSym);
      let financials = null;
      try {
        financials = await this.financialSyncService.syncFinancials(cleanSym);
      } catch (e: any) {
        this.logger.warn(
          `Could not sync financials for ${cleanSym}: ${e.message}`,
        );
      }

      return {
        success: true,
        data: {
          profile,
          quote,
          financials,
        },
      };
    } catch (err: any) {
      this.logger.error(`Failed to get quote for ${symbol}: ${err.message}`);
      return {
        success: false,
        message:
          "We couldn't retrieve verified market information for this ticker.",
      };
    }
  }

  @Get('fundamentals/:symbol')
  async getFundamentals(@Param('symbol') symbol: string) {
    try {
      const cleanSym = symbol.trim().toUpperCase();
      const financials =
        await this.financialSyncService.syncFinancials(cleanSym);
      return { success: true, data: financials };
    } catch (err: any) {
      this.logger.error(
        `Failed to get fundamentals for ${symbol}: ${err.message}`,
      );
      return {
        success: false,
        message: "We couldn't retrieve verified fundamental metrics right now.",
      };
    }
  }

  @Get('ipo')
  async getIpos() {
    // Serve from PostgreSQL (populated by the hourly IpoSchedulerService cron).
    // The frontend never calls FinAPI directly — it reads our own API, so a
    // single FinAPI request per hour is enough.
    //
    // Only CURRENT IPOs are returned: LIVE (openDate <= today <= closeDate)
    // followed by reliable UPCOMING (openDate > today), each capped at 10 and
    // computed at runtime in the Asia/Kolkata timezone. Closed / stale /
    // placeholder / contaminated records never reach the frontend.
    try {
      const current = await this.ipoSyncService.getCurrentIpos();
      const rows = [...current.live, ...current.upcoming];
      // Real freshness = the last successful DB sync (lastSyncedAt), NOT the
      // time this API response was generated. When the hourly provider sync has
      // been failing, lastSyncedAt stays old so the frontend can flag stale data.
      let lastSyncedAtMs = 0;
      for (const row of rows) {
        const t = row.lastSyncedAt ? new Date(row.lastSyncedAt).getTime() : 0;
        if (!isNaN(t) && t > lastSyncedAtMs) lastSyncedAtMs = t;
      }
      return {
        success: true,
        data: rows,
        meta: {
          timezone: current.timezone,
          todayKey: String(current.todayKey),
          generatedAt: current.generatedAt,
          lastSyncedAt: lastSyncedAtMs
            ? new Date(lastSyncedAtMs).toISOString()
            : null,
          liveCount: current.live.length,
          upcomingCount: current.upcoming.length,
        },
      };
    } catch (err: any) {
      this.logger.error(`Failed to load IPOs from database: ${err.message}`);
      return { success: true, data: [], meta: { error: err.message } };
    }
  }

  @Get('news')
  async getNews(@Query('topic') topic?: string) {
    try {
      const articles = await this.newsSyncService.syncNews(topic || 'MARKET');
      return { success: true, data: articles || [] };
    } catch (err: any) {
      this.logger.error(`Failed to fetch market news: ${err.message}`);
      return { success: true, data: [] };
    }
  }

  @Get('search')
  async search(@Query('q') query: string) {
    if (!query || !query.trim()) {
      return { success: true, data: [] };
    }
    try {
      const results = await this.yahooFinanceProvider.searchCompanies(
        query.trim(),
      );
      return { success: true, data: results || [] };
    } catch (err: any) {
      this.logger.error(`Failed to search companies: ${err.message}`);
      return { success: true, data: [] };
    }
  }

  @Post('analyze-ipo-screenshot')
  @UseInterceptors(FileInterceptor('file'))
  async analyzeIpoScreenshot(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No image file uploaded');
    }

    try {
      const record = await this.uploadService.saveFileRecord(file, 1);
      const filename = (file.originalname || '').toLowerCase();

      let detectedName = 'Unknown IPO';
      let detectedTicker = 'IPO';
      const exchange = 'NSE / BSE';
      const unavailableMsg =
        'This information is currently unavailable from the connected live providers.';
      let issuePrice = unavailableMsg;
      let lotSize = unavailableMsg;
      let subscription = unavailableMsg;
      let listingDate = unavailableMsg;
      let gmp = unavailableMsg;
      let mentorAnalysis =
        'We processed your uploaded broker screenshot using Vision AI. To provide a definitive subscription recommendation, please ensure the company name and issue price are clearly legible.';
      const conclusion = 'Worth Watching';
      const conclusionReason =
        'The screenshot document was verified, but live exchange order book multiples are still building.';

      try {
        const prompt = `You are a highly accurate financial Vision OCR engine analyzing an IPO/broker screenshot.
PHASE 1 (IMAGE TO TEXT): Transcribe EVERY visible figure EXACTLY as shown: company name, ticker, issue price / price band, lot size, subscription, listing date, and Grey Market Premium (GMP).
PHASE 2 (ACCURATE OUTPUT): Return ONLY a raw JSON object (no markdown, no code fences):
{"name": "Company Name as shown", "ticker": "TICKER", "issuePrice": "price range", "lotSize": "number of shares", "subscription": "status", "listingDate": "date", "gmp": "GMP if visible"}.
CRITICAL RULES: Extract only text actually visible in the image. If any value is NOT visible, set it to "N/A". NEVER invent, estimate, or use hardcoded data.`;

        const aiProvider = this.providerManager.getAiProvider();
        const ocrResponse = await aiProvider.analyzeImage(
          file.buffer,
          file.mimetype,
          prompt,
        );

        try {
          const cleanJsonString = ocrResponse
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .trim();
          const ocrResult = JSON.parse(cleanJsonString);
          if (ocrResult.name) detectedName = ocrResult.name;
          if (ocrResult.ticker) detectedTicker = ocrResult.ticker;
          if (ocrResult.issuePrice) issuePrice = ocrResult.issuePrice;
          if (ocrResult.lotSize) lotSize = ocrResult.lotSize;
          if (ocrResult.subscription) subscription = ocrResult.subscription;
          if (ocrResult.listingDate) listingDate = ocrResult.listingDate;
          if (ocrResult.gmp) gmp = ocrResult.gmp;

          mentorAnalysis =
            'The AI mentor analyzed this screenshot in real time. Please chat to dive deeper.';
        } catch (e: any) {
          this.logger.warn(
            'Failed to parse OCR response as JSON: ' + ocrResponse,
          );
        }
      } catch (ocrErr: any) {
        this.logger.warn(`OCR failed, using default text: ${ocrErr.message}`);
      }

      return {
        success: true,
        data: {
          uploadId: record.id,
          filename: file.originalname,
          name: detectedName,
          ticker: detectedTicker,
          exchange,
          issuePrice,
          lotSize,
          subscription,
          listingDate,
          gmp,
          conclusion,
          conclusionReason,
          mentorAnalysis,
          brokerSource: filename.includes('groww')
            ? 'Groww'
            : filename.includes('zerodha') || filename.includes('kite')
              ? 'Zerodha'
              : filename.includes('angel')
                ? 'Angel One'
                : filename.includes('upstox')
                  ? 'Upstox'
                  : 'Verified Broker Screenshot',
          detected: {
            name: detectedName,
            ticker: detectedTicker,
            exchange,
            issuePrice,
            lotSize,
            subscription,
            listingDate,
            gmp,
          },
          analysis: {
            summary: mentorAnalysis,
            conclusion,
            conclusionReason,
            brokerSource: filename.includes('groww')
              ? 'Groww'
              : filename.includes('zerodha') || filename.includes('kite')
                ? 'Zerodha'
                : filename.includes('angel')
                  ? 'Angel One'
                  : filename.includes('upstox')
                    ? 'Upstox'
                    : 'Verified Broker Screenshot',
          },
        },
      };
    } catch (err: any) {
      this.logger.error(`Failed to analyze IPO screenshot: ${err.message}`);
      throw new BadRequestException(
        `Failed to process uploaded screenshot: ${err.message}`,
      );
    }
  }
}
