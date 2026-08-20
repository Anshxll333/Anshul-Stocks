import { MarketQuoteDTO } from '../dto/market-quote.dto';
import { CompanyProfileDTO } from '../dto/company-profile.dto';

export class MarketMapper {
  static toQuoteDTO(raw: any, symbol: string): MarketQuoteDTO {
    const sym = symbol.toUpperCase();
    const parseNum = (val: any): number | null => {
      if (val === null || val === undefined || val === '') return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    };

    const currentPrice = parseNum(raw.close ?? raw.price ?? raw.currentPrice);
    const open = parseNum(raw.open);
    const high = parseNum(raw.high);
    const low = parseNum(raw.low);
    const close = parseNum(raw.close);
    const previousClose = parseNum(raw.previous_close ?? raw.previousClose);
    const change =
      parseNum(raw.change) ??
      (currentPrice !== null && previousClose !== null
        ? currentPrice - previousClose
        : null);
    const changePercent = parseNum(raw.percent_change ?? raw.changePercent);
    const volume = parseNum(raw.volume);
    const high52w = parseNum(raw.high52 ?? raw.fifty_two_week?.high);
    const low52w = parseNum(raw.low52 ?? raw.fifty_two_week?.low);

    return {
      symbol: sym,
      currentPrice: currentPrice as number,
      open: open as number,
      high: high as number,
      low: low as number,
      close: close as number,
      volume: volume as number,
      change: change ?? undefined,
      changePercent: changePercent ?? undefined,
      high52w: high52w ?? undefined,
      low52w: low52w ?? undefined,
      timestamp: raw.timestamp
        ? new Date(raw.timestamp).toISOString()
        : new Date().toISOString(),
      source: raw.source || 'ExternalMarketProvider',
    };
  }

  static toProfileDTO(raw: any, symbol: string): CompanyProfileDTO {
    const sym = symbol.toUpperCase();
    const parseNum = (val: any): number | null => {
      if (val === null || val === undefined || val === '') return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    };

    const rawMcap = parseNum(
      raw.marketCap ?? raw.market_cap ?? raw.marketCapCr,
    );
    const mcapCr =
      rawMcap !== null
        ? rawMcap > 10000000
          ? Math.round((rawMcap / 10000000) * 100) / 100
          : rawMcap
        : null;

    const rawEv = parseNum(raw.enterpriseValue ?? raw.enterpriseValueCr);
    const evCr =
      rawEv !== null
        ? rawEv > 10000000
          ? Math.round((rawEv / 10000000) * 100) / 100
          : rawEv
        : null;

    return {
      symbol: sym,
      companyName: raw.name || raw.companyName || sym,
      exchange: raw.exchange || 'NSE',
      sector: raw.sector || null,
      industry: raw.industry || null,
      marketCapCr: mcapCr as any,
      high52: parseNum(
        raw.high52 ?? raw.fifty_two_week?.high ?? raw.fiftyTwoWeekHigh,
      ) as any,
      low52: parseNum(
        raw.low52 ?? raw.fifty_two_week?.low ?? raw.fiftyTwoWeekLow,
      ) as any,
      volume: parseNum(raw.volume) as any,
      isin: raw.isin || null,
      website: raw.website || null,
      description: raw.description || null,
      enterpriseValueCr: evCr as any,
      beta: parseNum(raw.beta) as any,
      shareholding: raw.shareholding || undefined,
      quarterlyResults: raw.quarterlyResults || undefined,
      analystConsensus: raw.analystConsensus || undefined,
      targetPriceMean: parseNum(raw.targetPriceMean) as any,
    };
  }
}
