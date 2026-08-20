import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TwelveDataProvider } from './twelvedata.provider';
import { YahooFinanceProvider } from './yahoo-finance.provider';
import {
  MarketProviderFactory,
  MARKET_PROVIDER_TOKEN,
} from './market.provider';
import {
  TwelveDataIpoProvider,
  ExternalIpoApiProvider,
  IpoProviderFactory,
  IPO_PROVIDER_TOKEN,
} from './ipo.provider';
import { FinancialProvider } from './financial.provider';
import { NewsProvider } from './news.provider';
import { ProviderManager } from './provider.manager';
import { CompanySyncService } from './sync/company-sync.service';
import { FinancialSyncService } from './sync/financial-sync.service';
import { IpoSyncService } from './sync/ipo-sync.service';
import { IpoSchedulerService } from './sync/ipo-scheduler.service';
import { NewsSyncService } from './sync/news-sync.service';
import { AppLogger } from '../utils/logger';
import { GroqProvider } from './groq-ai.provider';
import { OpenAiProvider } from './openai-ai.provider';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    TwelveDataProvider,
    YahooFinanceProvider,
    MarketProviderFactory,
    TwelveDataIpoProvider,
    ExternalIpoApiProvider,
    IpoProviderFactory,
    FinancialProvider,
    NewsProvider,
    ProviderManager,
    CompanySyncService,
    FinancialSyncService,
    IpoSyncService,
    IpoSchedulerService,
    NewsSyncService,
    AppLogger,
    GroqProvider,
    OpenAiProvider,
  ],
  exports: [
    TwelveDataProvider,
    YahooFinanceProvider,
    MARKET_PROVIDER_TOKEN,
    TwelveDataIpoProvider,
    ExternalIpoApiProvider,
    IPO_PROVIDER_TOKEN,
    FinancialProvider,
    NewsProvider,
    ProviderManager,
    CompanySyncService,
    FinancialSyncService,
    IpoSyncService,
    NewsSyncService,
    AppLogger,
    GroqProvider,
    OpenAiProvider,
  ],
})
export class ProvidersModule {}
