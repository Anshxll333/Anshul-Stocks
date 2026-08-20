import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TwelveDataProvider } from './twelvedata.provider';
import { IMarketProvider } from './provider.interface';

export const MARKET_PROVIDER_TOKEN = 'MARKET_PROVIDER_TOKEN';

export const MarketProviderFactory: Provider = {
  provide: MARKET_PROVIDER_TOKEN,
  useFactory: (
    configService: ConfigService,
    twelveData: TwelveDataProvider,
  ): IMarketProvider => {
    const providerName = configService
      .get<string>('MARKET_PROVIDER', 'twelvedata')
      .toLowerCase();

    switch (providerName) {
      case 'twelvedata':
      default:
        return twelveData;
    }
  },
  inject: [ConfigService, TwelveDataProvider],
};
