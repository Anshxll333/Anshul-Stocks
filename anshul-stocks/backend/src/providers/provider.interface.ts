export interface MarketCompanyProfile {
  symbol: string;
  name: string;
  exchange: string;
  currency?: string;
  country?: string;
  sector?: string;
  industry?: string;
  description?: string;
  website?: string;
  isin?: string;
  marketCap?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
}

export interface MarketPriceQuote {
  symbol: string;
  currentPrice: number;
  open: number;
  high: number;
  low: number;
  close: number;
  previousClose?: number;
  change?: number;
  percentChange?: number;
  volume: number;
  timestamp: Date;
}

export interface MarketOhlcData {
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  date: string;
}

export interface MarketState {
  exchange: string;
  isOpen: boolean;
  code?: string;
}

export interface IMarketProvider {
  getProviderName(): string;
  getCompanyProfile(symbol: string): Promise<MarketCompanyProfile | null>;
  getCurrentQuote(symbol: string): Promise<MarketPriceQuote | null>;
  getDailyOhlc(symbol: string): Promise<MarketOhlcData | null>;
  getMarketStatus(exchange?: string): Promise<MarketState>;
  getBulkQuotes(symbols: string[]): Promise<Map<string, MarketPriceQuote>>;
  searchCompanies(query: string): Promise<MarketCompanyProfile[]>;
}

export interface RawIpoData {
  companyName: string;
  symbol?: string;
  exchange?: string;
  priceBand?: string;
  lotSize?: number;
  minInvestment?: number;
  issueSize?: number;
  openDate?: string;
  closeDate?: string;
  allotmentDate?: string;
  listingDate?: string;
  listingExchange?: string;
  subscriptionData?: string;
  gmp?: number;
  retailQuota?: string;
  qibQuota?: string;
  niiQuota?: string;
  registrar?: string;
  leadManagers?: string;
  category?: string;
  status?: string;
}

export interface IIpoProvider {
  getProviderName(): string;
  fetchUpcomingIpos(): Promise<RawIpoData[]>;
  fetchActiveIpos(): Promise<RawIpoData[]>;
  fetchHistoricalIpos(): Promise<RawIpoData[]>;
}

export interface MarketNewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: Date;
  symbols?: string[];
}

export interface INewsProvider {
  getProviderName(): string;
  fetchCompanyNews(symbol: string): Promise<MarketNewsItem[]>;
  fetchMarketNews(): Promise<MarketNewsItem[]>;
}
