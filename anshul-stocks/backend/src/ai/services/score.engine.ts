import { Injectable } from '@nestjs/common';
import { FinancialMetricDTO } from '../../providers/dto/financial-metric.dto';
import { CompanyProfileDTO } from '../../providers/dto/company-profile.dto';
import { MarketQuoteDTO } from '../../providers/dto/market-quote.dto';

export interface CategoryScore {
  score: number | null; // 0.0 - 10.0 or null if unavailable
  weight: number;
  availableMetrics: string[];
  missingMetrics: string[];
  assessment: string;
}

export interface AiScoreReport {
  symbol: string;
  companyName: string;
  overallScore: number | null; // 0.0 - 10.0 or null if insufficient data
  confidenceScore: number | null; // 0.0 - 10.0 or null
  dataCompletenessPercent: number; // 0 - 100
  recommendation: any;
  targetEntryPriceRange?: string;
  tradingLevels?: {
    entryZone: string;
    stopLoss: string;
    target1: string;
    target2: string;
  };
  insufficientDataNotice?: string;
  missingMetricsList?: string[];
  categories: {
    financialHealth: CategoryScore;
    profitability: CategoryScore;
    growth: CategoryScore;
    valuation: CategoryScore;
    capitalEfficiency: CategoryScore;
  };
}

export interface FundamentalCardsReport {
  revenueGrowth: string;
  profitGrowth: string;
  roe: string;
  roce: string;
  debt: string;
  valuation: string;
  businessQuality: string;
  managementQuality: string;
}

export interface AiScoreReport {
  symbol: string;
  companyName: string;
  overallScore: number | null; // 0.0 - 10.0 or null if insufficient data
  confidenceScore: number | null; // 0.0 - 10.0 or null
  dataCompletenessPercent: number; // 0 - 100
  recommendation: any;
  targetEntryPriceRange?: string;
  tradingLevels?: {
    entryZone: string;
    stopLoss: string;
    target1: string;
    target2: string;
  };
  insufficientDataNotice?: string;
  missingMetricsList?: string[];
  fundamentalCards: FundamentalCardsReport;
  ratingCalculationBreakdown?: {
    financialHealth: string;
    profitability: string;
    growth: string;
    valuation: string;
    capitalEfficiency: string;
  };
  categories: {
    financialHealth: CategoryScore;
    profitability: CategoryScore;
    growth: CategoryScore;
    valuation: CategoryScore;
    capitalEfficiency: CategoryScore;
  };
}

@Injectable()
export class ScoreEngine {
  calculateScore(
    profile: Partial<CompanyProfileDTO>,
    quote: Partial<MarketQuoteDTO>,
    financials: Partial<FinancialMetricDTO>,
  ): AiScoreReport {
    const symbol = (
      profile.symbol ||
      quote.symbol ||
      financials.symbol ||
      'COMPANY'
    ).toUpperCase();
    const companyName = profile.companyName || (profile as any).name || symbol;
    const currentPrice =
      quote.currentPrice ??
      quote.close ??
      (profile as any).currentPrice ??
      null;

    let evaluatedMetricCount = 0;
    let availableMetricCount = 0;

    const trackMetric = (val: any) => {
      evaluatedMetricCount++;
      if (val !== null && val !== undefined && !isNaN(Number(val))) {
        availableMetricCount++;
        return true;
      }
      return false;
    };

    // Extract all fundamental metrics from merged sources
    const debtToEquity =
      financials.debtToEquity ?? (profile as any).debtToEquity ?? null;
    const currentRatio =
      financials.currentRatio ?? (profile as any).currentRatio ?? null;
    const opMargin =
      financials.operatingMargin ?? (profile as any).operatingMargin ?? null;
    const netMargin =
      financials.netMargin ?? (profile as any).netMargin ?? null;
    const revenueGrowth =
      financials.revenueGrowthPercent ??
      (profile as any).revenueGrowthPercent ??
      (profile as any).revenueGrowth ??
      null;
    const profitGrowth =
      financials.profitGrowthPercent ??
      (profile as any).profitGrowthPercent ??
      (profile as any).earningsGrowth ??
      null;
    const revenueCr =
      financials.revenueCr ?? (profile as any).revenueCr ?? null;
    const netProfitCr =
      financials.netProfitCr ?? (profile as any).netProfitCr ?? null;
    const peRatio = financials.peRatio ?? (profile as any).peRatio ?? null;
    const pbRatio = financials.pbRatio ?? (profile as any).pbRatio ?? null;
    const roe = financials.roe ?? (profile as any).roe ?? null;
    const roce =
      financials.roce ?? (profile as any).roce ?? (profile as any).roa ?? null;
    const marketCapCr =
      financials.enterpriseValueCr ??
      (profile as any).marketCapCr ??
      ((profile as any).marketCap
        ? Math.round((profile as any).marketCap / 10000000)
        : null);
    const dividendYield =
      financials.dividendYield ?? (profile as any).dividendYield ?? null;
    const eps = financials.eps ?? (profile as any).eps ?? null;

    // Track completeness
    trackMetric(debtToEquity);
    trackMetric(currentRatio);
    trackMetric(opMargin);
    trackMetric(netMargin);
    trackMetric(revenueGrowth);
    trackMetric(profitGrowth);
    trackMetric(peRatio);
    trackMetric(pbRatio);
    trackMetric(roe);
    trackMetric(roce);
    trackMetric(marketCapCr);

    // 1. Financial Health (Debt & Liquidity)
    const healthScores: number[] = [];
    const healthAvailable: string[] = [];
    const healthMissing: string[] = [];

    if (debtToEquity !== null) {
      healthAvailable.push('Debt/Equity');
      if (debtToEquity <= 0.3) healthScores.push(9.5);
      else if (debtToEquity <= 0.8) healthScores.push(7.5);
      else if (debtToEquity <= 1.5) healthScores.push(5.5);
      else healthScores.push(3.5);
    } else {
      healthMissing.push('Debt/Equity');
    }

    if (currentRatio !== null) {
      healthAvailable.push('Current Ratio');
      if (currentRatio >= 1.5) healthScores.push(8.5);
      else if (currentRatio >= 1.0) healthScores.push(6.5);
      else healthScores.push(4.0);
    } else {
      healthMissing.push('Current Ratio');
    }

    const healthScore =
      healthScores.length > 0
        ? Math.round(
            (healthScores.reduce((a, b) => a + b, 0) / healthScores.length) *
              10,
          ) / 10
        : null;

    // 2. Profitability & Margins
    const profitScores: number[] = [];
    const profitAvailable: string[] = [];
    const profitMissing: string[] = [];

    if (opMargin !== null) {
      profitAvailable.push('Operating Margin');
      if (opMargin >= 20) profitScores.push(9.0);
      else if (opMargin >= 12) profitScores.push(7.5);
      else if (opMargin > 0) profitScores.push(5.5);
      else profitScores.push(2.5);
    } else {
      profitMissing.push('Operating Margin');
    }

    if (netMargin !== null) {
      profitAvailable.push('Net Margin');
      if (netMargin >= 15) profitScores.push(9.0);
      else if (netMargin >= 8) profitScores.push(7.0);
      else if (netMargin > 0) profitScores.push(5.0);
      else profitScores.push(2.0);
    } else {
      profitMissing.push('Net Margin');
    }

    const profitScore =
      profitScores.length > 0
        ? Math.round(
            (profitScores.reduce((a, b) => a + b, 0) / profitScores.length) *
              10,
          ) / 10
        : null;

    // 3. Growth & Momentum
    const growthScores: number[] = [];
    const growthAvailable: string[] = [];
    const growthMissing: string[] = [];

    if (revenueGrowth !== null) {
      growthAvailable.push('Revenue Growth');
      if (revenueGrowth >= 20) growthScores.push(9.5);
      else if (revenueGrowth >= 10) growthScores.push(8.0);
      else if (revenueGrowth > 0) growthScores.push(6.0);
      else growthScores.push(3.5);
    } else if (revenueCr !== null && revenueCr > 0) {
      growthAvailable.push('Revenue Scale');
      growthScores.push(7.5);
    } else {
      growthMissing.push('Revenue Growth');
    }

    if (profitGrowth !== null) {
      growthAvailable.push('Profit Growth');
      if (profitGrowth >= 20) growthScores.push(9.5);
      else if (profitGrowth >= 10) growthScores.push(8.0);
      else if (profitGrowth > 0) growthScores.push(6.0);
      else growthScores.push(3.0);
    } else if (netProfitCr !== null && netProfitCr > 0) {
      growthAvailable.push('Net Profit Scale');
      growthScores.push(7.5);
    } else {
      growthMissing.push('Profit Growth');
    }

    const growthScore =
      growthScores.length > 0
        ? Math.round(
            (growthScores.reduce((a, b) => a + b, 0) / growthScores.length) *
              10,
          ) / 10
        : null;

    // 4. Valuation
    const valScores: number[] = [];
    const valAvailable: string[] = [];
    const valMissing: string[] = [];

    if (peRatio !== null && peRatio > 0) {
      valAvailable.push('P/E Ratio');
      if (peRatio <= 20) valScores.push(9.0);
      else if (peRatio <= 35) valScores.push(7.5);
      else if (peRatio <= 65) valScores.push(5.5);
      else valScores.push(3.5);
    } else {
      valMissing.push('P/E Ratio');
    }

    if (pbRatio !== null && pbRatio > 0) {
      valAvailable.push('P/B Ratio');
      if (pbRatio <= 3.0) valScores.push(8.5);
      else if (pbRatio <= 6.0) valScores.push(7.0);
      else valScores.push(4.5);
    } else {
      valMissing.push('P/B Ratio');
    }

    const valScore =
      valScores.length > 0
        ? Math.round(
            (valScores.reduce((a, b) => a + b, 0) / valScores.length) * 10,
          ) / 10
        : null;

    // 5. Capital Efficiency (ROE & ROCE)
    const capScores: number[] = [];
    const capAvailable: string[] = [];
    const capMissing: string[] = [];

    if (roe !== null) {
      capAvailable.push('ROE');
      if (roe >= 20) capScores.push(9.5);
      else if (roe >= 14) capScores.push(8.0);
      else if (roe >= 8) capScores.push(6.0);
      else capScores.push(3.5);
    } else {
      capMissing.push('ROE');
    }

    if (roce !== null) {
      capAvailable.push('ROCE');
      if (roce >= 22) capScores.push(9.5);
      else if (roce >= 15) capScores.push(8.0);
      else if (roce >= 10) capScores.push(6.5);
      else capScores.push(4.0);
    } else {
      capMissing.push('ROCE');
    }

    const capScore =
      capScores.length > 0
        ? Math.round(
            (capScores.reduce((a, b) => a + b, 0) / capScores.length) * 10,
          ) / 10
        : null;

    // Overall Score calculation (average of non-empty categories)
    const evaluatedCategoryScores = [
      healthScore,
      profitScore,
      growthScore,
      valScore,
      capScore,
    ].filter((s) => s !== null) as number[];
    const overallScore =
      evaluatedCategoryScores.length > 0
        ? Math.round(
            (evaluatedCategoryScores.reduce((a, b) => a + b, 0) /
              evaluatedCategoryScores.length) *
              10,
          ) / 10
        : null;

    const dataCompletenessPercent = Math.round(
      (availableMetricCount / Math.max(1, evaluatedMetricCount)) * 100,
    );

    const missingMetricsList = [
      ...healthMissing,
      ...profitMissing,
      ...growthMissing,
      ...valMissing,
      ...capMissing,
    ];

    // Build rating calculation breakdown strings
    const ratingCalculationBreakdown = {
      financialHealth: healthScore !== null ? `${healthScore}/10 (${healthScore >= 7.5 ? 'Low Debt & Solid Balance Sheet' : 'Leverage Monitoring Needed'})` : 'Not Available',
      profitability: profitScore !== null ? `${profitScore}/10 (${profitScore >= 7.5 ? 'Strong Operating Margins' : 'Moderate Margins'})` : 'Not Available',
      growth: growthScore !== null ? `${growthScore}/10 (${growthScore >= 7.5 ? 'Solid Revenue & Earnings Expansion' : 'Stable Growth'})` : 'Not Available',
      valuation: valScore !== null ? `${valScore}/10 (${valScore >= 7.5 ? 'Fairly Valued' : 'Trading at Premium'})` : 'Not Available',
      capitalEfficiency: capScore !== null ? `${capScore}/10 (${capScore >= 7.5 ? 'High ROE & ROCE Returns' : 'Moderate Return Ratios'})` : 'Not Available',
    };

    // Build the 8 exact fundamental card strings for the UI
    const fundamentalCards: FundamentalCardsReport = {
      revenueGrowth:
        revenueGrowth !== null
          ? `${revenueGrowth}% YoY${growthScore !== null ? (growthScore >= 7.5 ? ' (Strong)' : ' (Moderate)') : ''}`
          : revenueCr !== null
            ? `₹${revenueCr} Cr Scale`
            : 'Not Available',
      profitGrowth:
        profitGrowth !== null
          ? `${profitGrowth}% YoY${profitScore !== null ? (profitScore >= 7.5 ? ' (Solid)' : ' (Stable)') : ''}`
          : netProfitCr !== null
            ? `₹${netProfitCr} Cr Net`
            : 'Not Available',
      roe:
        roe !== null
          ? `${roe}% (${roe >= 15 ? 'High' : 'Moderate'})`
          : opMargin !== null
            ? `${Math.round(opMargin * 1.1)}% (Est ROE)`
            : 'Not Available',
      roce:
        roce !== null
          ? `${roce}% (${roce >= 18 ? 'Strong' : 'Stable'})`
          : opMargin !== null
            ? `${Math.round(opMargin * 1.3)}% (Est ROCE)`
            : 'Not Available',
      debt:
        debtToEquity !== null
          ? `Debt/Eq: ${debtToEquity} (${debtToEquity <= 0.5 ? 'Low Debt' : debtToEquity <= 1.0 ? 'Moderate' : 'High Debt'})`
          : 'Not Available',
      valuation:
        peRatio !== null
          ? `P/E: ${peRatio}x${valScore !== null ? (valScore >= 7.5 ? ' (Fair)' : ' (Premium)') : ''}`
          : 'Not Available',
      businessQuality:
        opMargin !== null
          ? `Op Margin: ${opMargin}%${profitScore !== null ? (profitScore >= 7.5 ? ' (High Moat)' : ' (Stable)') : ''}`
          : 'Not Available',
      managementQuality:
        roce !== null || roe !== null
          ? `ROE ${roe !== null ? roe : 'N/A'}%, ROCE ${roce !== null ? roce : 'N/A'}%`
          : 'Not Available',
    };

    // Strict null policy: never invent a score when too much data is missing.
    // Below the 30% data-completeness threshold we return INSUFFICIENT DATA
    // instead of fabricating a neutral 5/10 rating.
    if (dataCompletenessPercent < 30) {
      return {
        symbol,
        companyName,
        overallScore: null,
        confidenceScore: null,
        dataCompletenessPercent,
        recommendation: 'INSUFFICIENT DATA',
        insufficientDataNotice: `Not enough free exchange data to calculate an automated valuation badge. Only ${dataCompletenessPercent}% of core financial metrics were available for ${companyName}.`,
        missingMetricsList,
        fundamentalCards,
        ratingCalculationBreakdown,
        categories: {
          financialHealth: {
            score: healthScore,
            weight: 0,
            availableMetrics: healthAvailable,
            missingMetrics: healthMissing,
            assessment: 'Insufficient data for an accurate assessment',
          },
          profitability: {
            score: profitScore,
            weight: 0,
            availableMetrics: profitAvailable,
            missingMetrics: profitMissing,
            assessment: 'Insufficient data for an accurate assessment',
          },
          growth: {
            score: growthScore,
            weight: 0,
            availableMetrics: growthAvailable,
            missingMetrics: growthMissing,
            assessment: 'Insufficient data for an accurate assessment',
          },
          valuation: {
            score: valScore,
            weight: 0,
            availableMetrics: valAvailable,
            missingMetrics: valMissing,
            assessment: 'Insufficient data for an accurate assessment',
          },
          capitalEfficiency: {
            score: capScore,
            weight: 0,
            availableMetrics: capAvailable,
            missingMetrics: capMissing,
            assessment: 'Insufficient data for an accurate assessment',
          },
        },
      };
    }

    let recommendation: any = 'BUY';
    if (overallScore === null) {
      recommendation = 'INSUFFICIENT DATA';
    } else if (overallScore >= 8.0) {
      recommendation = 'STRONG BUY / ACCUMULATE';
    } else if (overallScore >= 7.0) {
      recommendation = 'BUY ON DIPS / WATCH';
    } else if (overallScore >= 5.5) {
      recommendation = 'HOLD / NEUTRAL';
    } else {
      recommendation = 'AVOID / HIGH RISK';
    }

    let targetEntryPriceRange: string | undefined = undefined;
    let tradingLevels: any = undefined;
    if (currentPrice !== null && currentPrice > 0) {
      const lower = Math.round(currentPrice * 0.9 * 100) / 100;
      const upper = Math.round(currentPrice * 0.96 * 100) / 100;
      targetEntryPriceRange = `₹${lower.toFixed(2)} - ₹${upper.toFixed(2)}`;

      const entryLow = Math.round(currentPrice * 0.92 * 100) / 100;
      const entryHigh = Math.round(currentPrice * 0.97 * 100) / 100;
      const sl = Math.round(currentPrice * 0.85 * 100) / 100;
      const t1 = Math.round(currentPrice * 1.08 * 100) / 100;
      const t2 = Math.round(currentPrice * 1.18 * 100) / 100;
      tradingLevels = {
        entryZone: `₹${entryLow.toFixed(2)} - ₹${entryHigh.toFixed(2)}`,
        stopLoss: `₹${sl.toFixed(2)}`,
        target1: `₹${t1.toFixed(2)}`,
        target2: `₹${t2.toFixed(2)}`,
      };
    }

    return {
      symbol,
      companyName,
      overallScore,
      confidenceScore: Math.round((dataCompletenessPercent / 10) * 10) / 10,
      dataCompletenessPercent,
      recommendation,
      targetEntryPriceRange,
      tradingLevels,
      missingMetricsList,
      fundamentalCards,
      ratingCalculationBreakdown,
      categories: {
        financialHealth: {
          score: healthScore,
          weight: 0.25,
          availableMetrics: healthAvailable,
          missingMetrics: healthMissing,
          assessment:
            healthScore === null
              ? 'Insufficient data for an accurate assessment'
              : healthScore >= 7.5
                ? 'Strong balance sheet with controlled leverage'
                : 'Leverage requires monitoring',
        },
        profitability: {
          score: profitScore,
          weight: 0.25,
          availableMetrics: profitAvailable,
          missingMetrics: profitMissing,
          assessment:
            profitScore === null
              ? 'Insufficient data for an accurate assessment'
              : profitScore >= 7.5
                ? 'Healthy operating leverage & positive margins'
                : 'Margin expansion in progress',
        },
        growth: {
          score: growthScore,
          weight: 0.2,
          availableMetrics: growthAvailable,
          missingMetrics: growthMissing,
          assessment:
            growthScore === null
              ? 'Insufficient data for an accurate assessment'
              : 'Top-line and earnings growth trend evaluated from live provider filings',
        },
        valuation: {
          score: valScore,
          weight: 0.15,
          availableMetrics: valAvailable,
          missingMetrics: valMissing,
          assessment:
            valScore === null
              ? 'Insufficient data for an accurate assessment'
              : valScore >= 7.5
                ? 'Favorable valuation relative to growth'
                : 'Trading at premium growth multiple',
        },
        capitalEfficiency: {
          score: capScore,
          weight: 0.15,
          availableMetrics: capAvailable,
          missingMetrics: capMissing,
          assessment: capScore === null
              ? 'Insufficient data for an accurate assessment'
              : 'ROE & ROCE return ratios from provider metrics',
        },
      },
    };
  }
}
