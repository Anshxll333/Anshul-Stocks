import { FinancialMetricDTO } from '../dto/financial-metric.dto';

export class FinancialMapper {
  static toMetricDTO(raw: any, symbol: string): FinancialMetricDTO {
    const sym = symbol.toUpperCase();
    const parseNum = (val: any): number | null => {
      if (val === null || val === undefined || val === '') return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    };

    return {
      symbol: sym,
      revenueCr: parseNum(
        raw.revenueCr ??
          raw.revenue ??
          raw.operating_revenue ??
          raw.total_revenue,
      ) as any,
      netProfitCr: parseNum(
        raw.netProfitCr ?? raw.netProfit ?? raw.net_income,
      ) as any,
      eps: parseNum(raw.eps) as any,
      bookValue: parseNum(raw.bookValue) as any,
      peRatio: parseNum(raw.peRatio ?? raw.pe) as any,
      pbRatio: parseNum(raw.pbRatio ?? raw.pb) as any,
      roe: parseNum(raw.roe) as any,
      roce: parseNum(raw.roce) as any,
      debtToEquity: parseNum(raw.debtToEquity) as any,
      currentRatio: parseNum(raw.currentRatio) as any,
      operatingMargin: parseNum(
        raw.operatingMargin ?? raw.operating_margin,
      ) as any,
      netMargin: parseNum(raw.netMargin ?? raw.net_margin) as any,
      freeCashFlowCr: parseNum(raw.freeCashFlowCr ?? raw.free_cash_flow) as any,
      enterpriseValueCr: parseNum(
        raw.enterpriseValueCr ?? raw.enterprise_value,
      ) as any,
      dividendYield: parseNum(raw.dividendYield ?? raw.dividend_yield) as any,
      forwardPe: parseNum(raw.forwardPe ?? raw.forward_pe) as any,
      pegRatio: parseNum(raw.pegRatio ?? raw.peg_ratio) as any,
      roa: parseNum(raw.roa) as any,
      totalDebtCr: parseNum(raw.totalDebtCr ?? raw.total_debt) as any,
      totalCashCr: parseNum(raw.totalCashCr ?? raw.total_cash) as any,
      ebitdaCr: parseNum(raw.ebitdaCr ?? raw.ebitda) as any,
      revenueGrowthPercent: parseNum(
        raw.revenueGrowthPercent ?? raw.revenue_growth,
      ) as any,
      profitGrowthPercent: parseNum(
        raw.profitGrowthPercent ?? raw.earnings_growth,
      ) as any,
      operatingCashFlowCr: parseNum(
        raw.operatingCashFlowCr ?? raw.operating_cash_flow,
      ) as any,
      quickRatio: parseNum(raw.quickRatio ?? raw.quick_ratio) as any,
      interestCoverage: parseNum(
        raw.interestCoverage ?? raw.interest_coverage,
      ) as any,
      beta: parseNum(raw.beta) as any,
      promoterHoldingPercent: parseNum(
        raw.promoterHoldingPercent ?? raw.shareholding?.promoterHoldingPercent,
      ) as any,
      fiiHoldingPercent: parseNum(
        raw.fiiHoldingPercent ?? raw.shareholding?.fiiHoldingPercent,
      ) as any,
      diiHoldingPercent: parseNum(
        raw.diiHoldingPercent ?? raw.shareholding?.diiHoldingPercent,
      ) as any,
      publicHoldingPercent: parseNum(
        raw.publicHoldingPercent ?? raw.shareholding?.publicHoldingPercent,
      ) as any,
      quarterlyRevenueCr: parseNum(
        raw.quarterlyRevenueCr ?? raw.quarterlyResults?.[0]?.revenueCr,
      ) as any,
      quarterlyProfitCr: parseNum(
        raw.quarterlyProfitCr ?? raw.quarterlyResults?.[0]?.netProfitCr,
      ) as any,
      updatedAt: raw.updatedAt
        ? new Date(raw.updatedAt).toISOString()
        : new Date().toISOString(),
    };
  }
}
