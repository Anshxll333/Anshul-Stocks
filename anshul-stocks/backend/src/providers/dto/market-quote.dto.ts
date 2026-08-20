export interface MarketQuoteDTO {
  symbol: string;
  currentPrice: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change?: number;
  changePercent?: number;
  high52w?: number;
  low52w?: number;
  timestamp: string;
  source: string;
}
