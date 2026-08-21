import { Injectable } from '@nestjs/common';

export type DetectedIntent =
  | 'greeting'
  | 'stock_lookup'
  | 'financial_ratios'
  | 'ipo_details'
  | 'ipo_list'
  | 'news'
  | 'calculator'
  | 'vision'
  | 'general';

export interface IntentResult {
  intent: DetectedIntent;
  targetSymbol?: string;
  targetCompany?: string;
  listQuery?: boolean;
  calculationType?: string;
  uploadId?: string;
  confidence: number;
}

@Injectable()
export class IntentDetector {
  detect(userPrompt: string): IntentResult {
    const raw = userPrompt.trim();
    const text = raw.toLowerCase();

    // 0. Greeting Intent (must NEVER trigger company analysis)
    const isGreeting =
      /^(hi+|hello|heyy*|hey|greetings|good\s*(morning|afternoon|evening)|sup|wassup|howdy)(?:\s+(?:there|ai|mentor|anshul|bot|friend|sir|maam))*\s*[\s!.]*$/i.test(
        text,
      );
    if (isGreeting) {
      return {
        intent: 'greeting',
        confidence: 0.99,
      };
    }

    // 1. Vision / OCR Screenshot Intent
    if (
      text.includes('screenshot') ||
      text.includes('uploaded screenshot') ||
      text.includes('upload id') ||
      text.includes('ocr') ||
      text.includes('ledger') ||
      text.includes('broker statement') ||
      text.includes('portfolio picture')
    ) {
      const match = userPrompt.match(/Upload ID:\s*(\d+|latest)/i);
      return {
        intent: 'vision',
        uploadId: match ? match[1] : 'latest',
        confidence: 0.96,
      };
    }

    // 2. Calculator Intent
    if (
      text.includes('cagr') ||
      text.includes('future value') ||
      text.includes('position size') ||
      text.includes('risk reward') ||
      text.includes('calculate')
    ) {
      return {
        intent: 'calculator',
        calculationType: 'financial_math',
        confidence: 0.95,
      };
    }

    // 3. IPO Intent
    if (
      text.includes('ipo') ||
      text.includes('drhp') ||
      text.includes('prospectus') ||
      text.includes('gmp') ||
      text.includes('subscription')
    ) {
      // 3a. IPO list query detection: "current IPOs", "live IPOs",
      //     "upcoming IPOs", "list of IPOs", "show me the open IPOs".
      const isListQuery =
        /\b(current|live|upcoming|all|open|latest|active|ongoing|today'?s|todays|available|new|recent)\s+(ipo|ipos)\b/.test(
          text,
        ) ||
        /\b(ipo|ipos)\s+(list|calendar|updates|status|overview)\b/.test(text) ||
        /\b(list|show|get|give|fetch|display)\s+(?:me\s+)?(?:the\s+)?(?:all\s+)?\bipos?\b/.test(text);

      const extractedCompany = this.extractIpoCompany(userPrompt);

      // Bare IPO questions without a specific company (e.g. "should I apply for
      // an IPO?") are treated as list queries so the mentor can present the
      // live open/upcoming IPOs instead of a fabricated single company.
      if (isListQuery || !extractedCompany) {
        return { intent: 'ipo_list', listQuery: true, confidence: 0.95 };
      }

      return {
        intent: 'ipo_details',
        targetCompany: extractedCompany,
        confidence: 0.92,
      };
    }

    // 4. Financial Ratios Intent
    if (
      text.includes('pe ratio') ||
      text.includes('roe') ||
      text.includes('roce') ||
      text.includes('revenue') ||
      text.includes('net profit') ||
      text.includes('eps') ||
      text.includes('debt to equity') ||
      text.includes('balance sheet') ||
      text.includes('fundamental')
    ) {
      const symbol =
        this.extractSymbol(userPrompt) ||
        userPrompt
          .replace(
            /pe ratio|roe|roce|revenue|net profit|eps|debt to equity|balance sheet|fundamental|ratios|financials/gi,
            '',
          )
          .trim();
      return {
        intent: 'financial_ratios',
        targetSymbol: symbol || undefined,
        confidence: 0.9,
      };
    }

    // 5. News Intent
    if (
      text.includes('news') ||
      text.includes('headline') ||
      text.includes('update') ||
      text.includes('sentiment')
    ) {
      const symbol =
        this.extractSymbol(userPrompt) ||
        userPrompt.replace(/news|headline|update|sentiment/gi, '').trim();
      return {
        intent: 'news',
        targetSymbol: symbol || undefined,
        confidence: 0.88,
      };
    }

    // 5.5 Generic Screener / Top Stocks Intent (Not a single stock lookup)
    const screenerKeywords = /\b(top\s+\d+\s+stocks|best\s+stocks|suggest\s+(?:some\s+)?stocks|recommend\s+(?:some\s+)?stocks|list\s+of\s+stocks|stocks\s+to\s+invest)\b/i;
    const isScreenerQuery = screenerKeywords.test(text) || text.includes('top 10 stocks');
    
    if (isScreenerQuery) {
      const extracted = this.extractSymbol(userPrompt);
      // If no symbol was extracted, or if the extracted symbol is just a generic phrase 
      // falsely extracted by Rule 3 (like "INVESTING TOP 10 STOCKS"), treat as general.
      // We assume a real symbol is usually short (1-2 words).
      if (!extracted || extracted.split(/\s+/).length > 2) {
        return { intent: 'general', confidence: 0.95 };
      }
    }

    // 6. Stock Quote / Profile Intent
    const hasStockKeywords =
      text.includes('stock') ||
      text.includes('price') ||
      text.includes('market cap') ||
      text.includes('52 week') ||
      text.includes('volume') ||
      text.includes('tell about') ||
      text.includes('analyze') ||
      text.includes('buy');
    const symbolCandidate = this.extractSymbol(userPrompt);

    if (hasStockKeywords || symbolCandidate) {
      const fallbackSym = userPrompt
        .replace(
          /stock|price|market cap|52 week|volume|tell about|analyze|buy|share|company|for/gi,
          '',
        )
        .trim();
      return {
        intent: 'stock_lookup',
        targetSymbol:
          symbolCandidate ||
          (fallbackSym && fallbackSym.length >= 2 ? fallbackSym : undefined),
        confidence: 0.89,
      };
    }

    return { intent: 'general', confidence: 0.5 };
  }

  /**
   * Extracts a clean IPO company name from a natural language query.
   *
   * Examples:
   *   "tell me about Dhoot Transmission IPO"   -> "Dhoot Transmission"
   *   "What is the GMP of Swiggy IPO?"         -> "Swiggy"
   *   "should I apply for the LIC IPO"         -> "LIC"
   *   "tell me the current IPOs"               -> undefined (list query)
   */
  private extractIpoCompany(userPrompt: string): string | undefined {
    const fillerWords =
      /\b(tell|me|about|what|is|are|the|of|an|a|can|you|please|current|live|upcoming|all|list|latest|today'?s|todays|open|for|with|and|to|show|get|give|should|i|we|do|know|want|need|on|in|my|this|that|some|any|these|those|gmp|subscription|drhp|prospectus|status|price|band|lot|details|review|analysis|ipo|ipos|capital|invest|apply|buy|its|grey|market|premium|total|multiple|overall|available)\b/gi;

    // 1. Split the prompt around the IPO keywords so "of Swiggy IPO" isolates
    //    the company even when GMP/subscription keywords appear earlier.
    const keywords = /\b(?:ipo|drhp|prospectus|gmp|subscription)\b/gi;
    const segments: string[] = [];
    let cursor = 0;
    for (const m of userPrompt.matchAll(keywords)) {
      if (m.index !== undefined && m.index > cursor) {
        segments.push(userPrompt.slice(cursor, m.index));
      }
      cursor = (m.index ?? 0) + m[0].length;
    }
    if (cursor < userPrompt.length) {
      segments.push(userPrompt.slice(cursor));
    }

    // 2. Clean each segment of filler words / symbols and keep the longest
    //    surviving fragment that looks like a company name.
    let best: string | undefined;
    for (const segment of segments) {
      const cleaned = segment
        .replace(fillerWords, ' ')
        .replace(/[^\p{L}\p{N} .&'-]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (cleaned.length >= 2 && (!best || cleaned.length > best.length)) {
        best = cleaned;
      }
    }

    return best;
  }

  private extractSymbol(text: string): string | undefined {
    // 1. Check for explicit .NS, .BO, .NSE, or .BSE suffix symbols first
    const suffixMatch = text.match(
      /\b([a-zA-Z0-9^]+(?:\.NS|\.BO|\.NSE|\.BSE))\b/i,
    );
    if (suffixMatch && suffixMatch[1]) {
      return suffixMatch[1]
        .toUpperCase()
        .replace(/\.NSE$/i, '.NS')
        .replace(/\.BSE$/i, '.BO');
    }

    const lower = text.toLowerCase();
    if (lower.includes('zomato') || lower.includes('eternal')) return 'ZOMATO';
    if (
      lower.includes('bank of baroda') ||
      lower.includes('bankofbaroda') ||
      lower.includes('baroda')
    )
      return 'BANKBARODA';
    if (
      lower.includes('hindustan copper') ||
      lower.includes('hindcopper') ||
      lower.includes('hindustan cooper') ||
      lower.includes('hindustancooper')
    )
      return 'HINDCOPPER';
    if (lower.includes('tata steel') || lower.includes('tatasteel'))
      return 'TATASTEEL';
    if (lower.includes('coal india') || lower.includes('coalindia'))
      return 'COALINDIA';
    if (lower.includes('bharat electronics') || lower.includes(' bel '))
      return 'BEL';
    if (lower.includes('hindustan aeronautics') || lower.includes(' hal '))
      return 'HAL';
    if (
      lower.includes('reliance') ||
      lower.includes('relaince') ||
      lower.includes('reliace')
    )
      return 'RELIANCE';
    if (lower.includes('tcs') || lower.includes('tata consultancy'))
      return 'TCS';
    if (lower.includes('hdfc')) return 'HDFCBANK';
    if (
      lower.includes('infosys') ||
      lower.includes('infy') ||
      lower.includes('inforsys')
    )
      return 'INFY';
    if (lower.includes('tata motors') || lower.includes('tatamotors'))
      return 'TATAMOTORS';
    if (lower.includes('tata power') || lower.includes('tatapower'))
      return 'TATAPOWER';
    if (lower.includes('swiggy')) return 'SWIGGY';
    if (lower.includes('wipro')) return 'WIPRO';
    if (lower.includes('icici')) return 'ICICIBANK';
    if (
      lower.includes('sbi funds') ||
      lower.includes('sbi mutual') ||
      lower.includes('sbi etf') ||
      lower.includes('sbifunds')
    )
      return 'SBIFUNDS';
    if (lower.includes('sbi') || lower.includes('state bank')) return 'SBIN';
    if (lower.includes('itc')) return 'ITC';
    if (lower.includes('bharti') || lower.includes('airtel'))
      return 'BHARTIARTL';
    if (lower.includes('kotak')) return 'KOTAKBANK';
    if (lower.includes('axis')) return 'AXISBANK';
    if (lower.includes('larsen') || lower.includes('l&t')) return 'LT';
    if (lower.includes('bajaj finance') || lower.includes('bajfinance'))
      return 'BAJFINANCE';
    if (lower.includes('maruti')) return 'MARUTI';
    if (lower.includes('adani')) return 'ADANIENT';
    if (lower.includes('asian paint')) return 'ASIANPAINT';

    // 2. Check for explicit uppercase tickers
    const upperMatch = text.match(/\b[A-Z]{3,10}\b/);
    if (
      upperMatch &&
      ![
        'THE',
        'AND',
        'FOR',
        'BUY',
        'IPO',
        'HIGH',
        'LOW',
        'WHAT',
        'HOW',
        'HII',
        'ABOUT',
        'TELL',
        'WITH',
        'FROM',
        'THIS',
        'THAT',
        'HAVE',
        'NOTE',
        'WHEN',
      ].includes(upperMatch[0])
    ) {
      return upperMatch[0];
    }

    // 3. Extract word following "tell about", "analyze", "stock"
    const match = text.match(
      /(?:about|analyze|stock|share|company|for|buy)\s+([a-zA-Z0-9\s-]+)/i,
    );
    if (match && match[1] && match[1].trim().length >= 3) {
      return match[1].trim().toUpperCase();
    }

    return undefined;
  }
}
