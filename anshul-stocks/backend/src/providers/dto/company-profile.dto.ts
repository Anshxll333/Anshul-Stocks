export interface ShareholdingPattern {
  promoterHoldingPercent?: number;
  fiiHoldingPercent?: number;
  diiHoldingPercent?: number;
  publicHoldingPercent?: number;
}

export interface QuarterlyResultItem {
  periodEnd: string;
  revenueCr?: number;
  netProfitCr?: number;
}

export interface CompanyProfileDTO {
  symbol: string;
  companyName: string;
  exchange: string;
  sector: string;
  industry: string;
  marketCapCr: number;
  high52: number;
  low52: number;
  volume: number;
  isin?: string;
  website?: string;
  description?: string;
  enterpriseValueCr?: number;
  beta?: number;
  shareholding?: ShareholdingPattern;
  quarterlyResults?: QuarterlyResultItem[];
  analystConsensus?: string;
  targetPriceMean?: number;
}
