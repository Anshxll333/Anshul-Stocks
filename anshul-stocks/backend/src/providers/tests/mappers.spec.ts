import { MarketMapper } from '../mappers/market.mapper';
import { FinancialMapper } from '../mappers/financial.mapper';
import { IPOMapper } from '../mappers/ipo.mapper';
import { NewsMapper } from '../mappers/news.mapper';

describe('Sprint 5.5 Normalization Mappers Unit Tests', () => {
  it('MarketMapper should correctly normalize raw price payload to MarketQuoteDTO', () => {
    const raw = {
      close: '2850.50',
      open: '2830.00',
      high: '2870.00',
      low: '2820.00',
      volume: '4500000',
    };
    const dto = MarketMapper.toQuoteDTO(raw, 'RELIANCE');

    expect(dto.symbol).toBe('RELIANCE');
    expect(dto.currentPrice).toBe(2850.5);
    expect(dto.open).toBe(2830.0);
    expect(dto.volume).toBe(4500000);
    expect(dto.source).toBeDefined();
  });

  it('FinancialMapper should correctly normalize raw financial payload to FinancialMetricDTO', () => {
    const raw = {
      revenueCr: 890000,
      netProfitCr: 69000,
      peRatio: 26.8,
      eps: 102.5,
    };
    const dto = FinancialMapper.toMetricDTO(raw, 'RELIANCE');

    expect(dto.symbol).toBe('RELIANCE');
    expect(dto.revenueCr).toBe(890000);
    expect(dto.peRatio).toBe(26.8);
    expect(dto.eps).toBe(102.5);
  });

  it('IPOMapper should correctly normalize raw IPO filing to IPODataDTO', () => {
    const raw = {
      companyName: 'Swiggy Limited',
      issuePrice: 390,
      priceBand: '₹371 - ₹390',
      lotSize: 38,
      status: 'listed',
    };
    const dto = IPOMapper.toIPODTO(raw);

    expect(dto.companyName).toBe('Swiggy Limited');
    expect(dto.issuePrice).toBe(390);
    expect(dto.lotSize).toBe(38);
    expect(dto.status).toBe('listed');
  });

  it('IPOMapper.parseUpperPrice should tolerate ₹ symbols in FinAPI ranges', () => {
    expect(IPOMapper.parseUpperPrice('₹92 – ₹97')).toBe(97);
    expect(IPOMapper.parseUpperPrice('₹151 – ₹159')).toBe(159);
    expect(IPOMapper.parseUpperPrice('151 - 159')).toBe(159);
    expect(IPOMapper.parseUpperPrice('Rs. 92 – 97')).toBe(97);
    expect(IPOMapper.parseUpperPrice('₹1,000 – ₹1,200')).toBe(1200);
  });

  it('IPOMapper.parseUpperPrice should fall back to single fixed prices and NULL for no price', () => {
    expect(IPOMapper.parseUpperPrice('₹151')).toBe(151);
    expect(IPOMapper.parseUpperPrice('151')).toBe(151);
    expect(IPOMapper.parseUpperPrice('–')).toBeNull();
    expect(IPOMapper.parseUpperPrice('')).toBeNull();
    expect(IPOMapper.parseUpperPrice(null)).toBeNull();
  });

  it('NewsMapper should correctly normalize raw news feed item to NewsArticleDTO', () => {
    const raw = {
      title: 'RBI Policy Rate Update',
      summary: 'Repo rate unchanged',
      source: 'Economic Times',
    };
    const dto = NewsMapper.toArticleDTO(raw, 'NIFTY50');

    expect(dto).not.toBeNull();
    expect(dto!.headline).toBe('RBI Policy Rate Update');
    expect(dto!.source).toBe('Economic Times');
    expect(dto!.symbols).toContain('NIFTY50');
  });
});
