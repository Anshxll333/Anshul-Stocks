import { IntentDetector } from './intent-detector';

describe('IntentDetector IPO integration', () => {
  let detector: IntentDetector;

  beforeEach(() => {
    detector = new IntentDetector();
  });

  it('detects "tell me the current IPOs" as an IPO list query', () => {
    const result = detector.detect('tell me the current IPOs');
    expect(result.intent).toBe('ipo_list');
    expect(result.listQuery).toBe(true);
  });

  it('detects "what are the live IPOs" as an IPO list query', () => {
    const result = detector.detect('what are the live IPOs');
    expect(result.intent).toBe('ipo_list');
  });

  it('detects "upcoming IPOs" as an IPO list query', () => {
    const result = detector.detect('upcoming IPOs');
    expect(result.intent).toBe('ipo_list');
  });

  it('detects "list of IPOs" as an IPO list query', () => {
    const result = detector.detect('list of IPOs');
    expect(result.intent).toBe('ipo_list');
  });

  it('treats a bare "should I apply for an IPO" as a list query', () => {
    const result = detector.detect('should I apply for an IPO');
    expect(result.intent).toBe('ipo_list');
  });

  it('extracts a clean company name from "tell me about Dhoot Transmission IPO"', () => {
    const result = detector.detect('tell me about Dhoot Transmission IPO');
    expect(result.intent).toBe('ipo_details');
    expect(result.targetCompany).toBe('Dhoot Transmission');
  });

  it('extracts the company when GMP keyword appears first', () => {
    const result = detector.detect('What is the GMP of Swiggy IPO?');
    expect(result.intent).toBe('ipo_details');
    expect(result.targetCompany).toBe('Swiggy');
  });

  it('extracts a short company name from "LIC IPO"', () => {
    const result = detector.detect('LIC IPO');
    expect(result.intent).toBe('ipo_details');
    expect(result.targetCompany).toBe('LIC');
  });

  it('keeps multi-word company names like "Indo-Nim IPO"', () => {
    const result = detector.detect('Indo-Nim IPO');
    expect(result.intent).toBe('ipo_details');
    expect(result.targetCompany).toBe('Indo-Nim');
  });

  it('keeps multi-word names like "Hyundai India IPO"', () => {
    const result = detector.detect('Hyundai India IPO');
    expect(result.intent).toBe('ipo_details');
    expect(result.targetCompany).toBe('Hyundai India');
  });

  it('extracts the company when grey market premium words follow the IPO name', () => {
    const result = detector.detect(
      'Should I apply to the Dhoot Transmission IPO? Tell me its grey market premium and total subscription multiple.',
    );
    expect(result.intent).toBe('ipo_details');
    expect(result.targetCompany).toBe('Dhoot Transmission');
  });

  it('does not treat greetings as IPO queries', () => {
    const result = detector.detect('Hello AI Mentor');
    expect(result.intent).toBe('greeting');
  });

  it('does not hijack financial ratio queries', () => {
    const result = detector.detect('What is P/E ratio and ROE of TCS?');
    expect(result.intent).toBe('financial_ratios');
  });

  it('detects "can you suggest the stocks for investing top 10 stocks" as a general intent (screener)', () => {
    const result = detector.detect('can you suggest the stocks for investing top 10 stocks');
    expect(result.intent).toBe('general');
  });

  it('detects "recommend some stocks" as a general intent (screener)', () => {
    const result = detector.detect('recommend some stocks');
    expect(result.intent).toBe('general');
  });

  it('detects "stocks to invest in" as a general intent (screener)', () => {
    const result = detector.detect('stocks to invest in');
    expect(result.intent).toBe('general');
  });

  it('DOES NOT detect "is TCS a good stock?" as a screener intent because it contains a target symbol', () => {
    const result = detector.detect('is TCS a good stock?');
    // It should hit stock_lookup and extract TCS
    expect(result.intent).toBe('stock_lookup');
    expect(result.targetSymbol).toBe('TCS');
  });

  it('DOES NOT detect "recommend TCS" as a screener intent because it contains a target symbol', () => {
    const result = detector.detect('recommend TCS');
    expect(result.intent).toBe('stock_lookup');
    expect(result.targetSymbol).toBe('TCS');
  });

  it('DOES NOT detect "suggest whether I should buy TCS" as a screener intent', () => {
    const result = detector.detect('suggest whether I should buy TCS');
    expect(result.intent).toBe('stock_lookup');
    expect(result.targetSymbol).toBe('TCS');
  });
});
