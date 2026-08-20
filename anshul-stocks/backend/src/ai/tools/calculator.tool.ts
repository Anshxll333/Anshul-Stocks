import { Injectable } from '@nestjs/common';
import { ITool, ToolMetadata, ToolResult } from './tool.interface';

export interface CalculatorInput {
  operation:
    | 'cagr'
    | 'return'
    | 'future_value'
    | 'pe_ratio'
    | 'eps'
    | 'market_cap'
    | 'position_size'
    | 'risk_reward';
  initialValue?: number;
  finalValue?: number;
  years?: number;
  price?: number;
  earnings?: number;
  netIncome?: number;
  outstandingShares?: number;
  portfolioSize?: number;
  riskPercent?: number;
  stopLossPrice?: number;
  targetPrice?: number;
  entryPrice?: number;
}

@Injectable()
export class CalculatorTool implements ITool<CalculatorInput, any> {
  readonly metadata: ToolMetadata = {
    name: 'financial_calculator',
    description:
      'Calculates financial metrics: CAGR, Percentage Return, Future Value, P/E, EPS, Market Cap, Position Size, and Risk-Reward ratio.',
    parametersSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          description:
            'cagr | return | future_value | pe_ratio | eps | market_cap | position_size | risk_reward',
        },
        initialValue: { type: 'number' },
        finalValue: { type: 'number' },
        years: { type: 'number' },
        price: { type: 'number' },
        earnings: { type: 'number' },
        netIncome: { type: 'number' },
        outstandingShares: { type: 'number' },
        portfolioSize: { type: 'number' },
        riskPercent: { type: 'number' },
        entryPrice: { type: 'number' },
        stopLossPrice: { type: 'number' },
        targetPrice: { type: 'number' },
      },
      required: ['operation'],
    },
  };

  async execute(input: CalculatorInput): Promise<ToolResult<any>> {
    const startTime = Date.now();
    let resultData: any = {};

    switch (input.operation) {
      case 'cagr': {
        const pv = input.initialValue || 100;
        const fv = input.finalValue || 200;
        const n = input.years || 3;
        const cagrVal = (Math.pow(fv / pv, 1 / n) - 1) * 100;
        resultData = {
          operation: 'CAGR (Compound Annual Growth Rate)',
          initialValue: pv,
          finalValue: fv,
          years: n,
          cagrPercent: Number(cagrVal.toFixed(2)),
          formula: '((FV / PV) ^ (1 / n)) - 1',
        };
        break;
      }

      case 'return': {
        const pv = input.initialValue || 100;
        const fv = input.finalValue || 150;
        const absReturn = fv - pv;
        const pctReturn = ((fv - pv) / pv) * 100;
        resultData = {
          operation: 'Percentage Return & Absolute Gain',
          initialValue: pv,
          finalValue: fv,
          absoluteGain: Number(absReturn.toFixed(2)),
          percentageReturn: Number(pctReturn.toFixed(2)),
        };
        break;
      }

      case 'future_value': {
        const pv = input.initialValue || 10000;
        const rate = (input.riskPercent || 12) / 100;
        const n = input.years || 5;
        const fv = pv * Math.pow(1 + rate, n);
        resultData = {
          operation: 'Future Value (Compounded)',
          principal: pv,
          annualRatePercent: input.riskPercent || 12,
          years: n,
          futureValue: Number(fv.toFixed(2)),
        };
        break;
      }

      case 'pe_ratio': {
        const p = input.price || 2850;
        const eps = input.earnings || 102.5;
        const pe = p / eps;
        resultData = {
          operation: 'P/E Ratio Calculation',
          stockPrice: p,
          eps,
          peRatio: Number(pe.toFixed(2)),
        };
        break;
      }

      case 'eps': {
        const income = input.netIncome || 69000; // in Cr
        const shares = input.outstandingShares || 676; // in Cr
        const epsVal = income / shares;
        resultData = {
          operation: 'Earnings Per Share (EPS)',
          netIncomeCr: income,
          outstandingSharesCr: shares,
          eps: Number(epsVal.toFixed(2)),
        };
        break;
      }

      case 'market_cap': {
        const price = input.price || 2850;
        const shares = input.outstandingShares || 676; // in Cr
        const mcapCr = price * shares;
        resultData = {
          operation: 'Market Capitalization',
          sharePrice: price,
          outstandingSharesCr: shares,
          marketCapCr: Number(mcapCr.toFixed(2)),
        };
        break;
      }

      case 'position_size': {
        const capital = input.portfolioSize || 100000;
        const riskPct = input.riskPercent || 2; // 2% risk
        const entry = input.entryPrice || 500;
        const stop = input.stopLossPrice || 470;
        const riskAmount = capital * (riskPct / 100);
        const riskPerShare = Math.abs(entry - stop);
        const quantity = Math.floor(riskAmount / riskPerShare);
        const totalInvestment = quantity * entry;
        resultData = {
          operation: 'Position Sizing & Risk Management',
          portfolioCapital: capital,
          riskPercentage: riskPct,
          riskAmount,
          entryPrice: entry,
          stopLossPrice: stop,
          riskPerShare,
          recommendedQuantity: quantity,
          totalInvestmentAmount: totalInvestment,
        };
        break;
      }

      case 'risk_reward': {
        const entry = input.entryPrice || 100;
        const stop = input.stopLossPrice || 90;
        const target = input.targetPrice || 130;
        const risk = Math.abs(entry - stop);
        const reward = Math.abs(target - entry);
        const ratio = reward / risk;
        resultData = {
          operation: 'Risk-to-Reward Ratio',
          entryPrice: entry,
          stopLossPrice: stop,
          targetPrice: target,
          riskPerShare: risk,
          rewardPerShare: reward,
          riskRewardRatio: `1 : ${ratio.toFixed(2)}`,
        };
        break;
      }

      default: {
        const pv = input.initialValue || 100;
        const fv = input.finalValue || 200;
        const n = input.years || 3;
        const cagrVal = (Math.pow(fv / pv, 1 / n) - 1) * 100;
        resultData = {
          operation: 'CAGR Calculation',
          cagrPercent: Number(cagrVal.toFixed(2)),
        };
      }
    }

    return {
      success: true,
      toolName: this.metadata.name,
      data: resultData,
      executionTimeMs: Date.now() - startTime,
    };
  }
}
