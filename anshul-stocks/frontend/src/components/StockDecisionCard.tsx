import React, { useState } from 'react';
import {
  Star,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  TrendingUp,
  DollarSign,
  Layers,
  Activity,
  FileText,
  Newspaper,
  Building2,
  PieChart,
  Wallet,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

export interface StockDecisionData {
  type: 'stock';
  companyName: string;
  currentPrice: string;
  companyOverview?: string;
  overallAiRating: number;
  ratingCalculationBreakdown?: {
    financialHealth?: string | number;
    profitability?: string | number;
    growth?: string | number;
    valuation?: string | number;
    capitalEfficiency?: string | number;
  };
  recommendation: 'Strong Buy' | 'Buy' | 'Hold' | 'Hold / Neutral' | 'Avoid' | 'Leave / Avoid' | string;
  fundamentals: {
    revenueGrowth: string;
    profitGrowth: string;
    roe: string;
    roce: string;
    debt: string;
    valuation: string;
    businessQuality: string;
    managementQuality: string;
  };
  bestBuyZone?: string;
  avoidAbovePrice?: string;
  keyRisks: string[];
  bottomLine: string;
  mentorInvestmentAdvice?: {
    askUserCapital?: string;
    stagedStrategyExample?: string;
  };
  detailedInfoPrompt?: string;
  details?: {
    companyOverview?: string;
    completeFinancials?: string;
    quarterlyResults?: string;
    cashFlow?: string;
    balanceSheet?: string;
    valuationDetails?: string;
    technicalAnalysis?: string;
    news?: string;
    fullAiExplanation?: string;
  };
}

export const StockDecisionCard: React.FC<{
  data: StockDecisionData;
  onSendPrompt?: (prompt: string) => void;
}> = ({ data, onSendPrompt }) => {
  // ── Defensive field guards: AI content can arrive with missing/malformed
  //    fields. Rendering must NEVER throw (an uncaught render error without an
  //    error boundary blanked the whole app). ──
  const safeRecommendation = typeof data.recommendation === 'string' ? data.recommendation : 'Hold';
  const safeRating = Number(data.overallAiRating);
  const finalRating = Number.isFinite(safeRating) ? safeRating : 0;
  const hasRating = Number.isFinite(safeRating) && safeRating > 0;
  const ratingLabel = hasRating ? `${finalRating} / 10` : 'Not available';
  const safeKeyRisks = Array.isArray(data.keyRisks) ? data.keyRisks : [];

  const getRecommendationBadge = (rec: string) => {
    const clean = (rec || 'Hold').toLowerCase();
    if (clean.includes('strong buy')) {
      return 'bg-sky-500 text-white border-sky-400 shadow-md shadow-sky-500/20';
    }
    if (clean.includes('buy')) {
      return 'bg-blue-600 text-white border-blue-500 shadow-sm';
    }
    if (clean.includes('hold')) {
      return 'bg-amber-500 text-white border-amber-400 shadow-sm';
    }
    return 'bg-red-500 text-white border-red-400 shadow-sm';
  };

  const getScoreColor = (rating: number) => {
    const r = Number(rating) || 0;
    if (r >= 8) return 'text-sky-400 bg-sky-500/10 border-sky-500/30';
    if (r >= 6) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-red-400 bg-red-500/10 border-red-500/30';
  };

  const fundamentalItems = [
    { label: 'Revenue Growth', val: data.fundamentals?.revenueGrowth || 'N/A' },
    { label: 'Profit Growth', val: data.fundamentals?.profitGrowth || 'N/A' },
    { label: 'ROE', val: data.fundamentals?.roe || 'N/A' },
    { label: 'ROCE', val: data.fundamentals?.roce || 'N/A' },
    { label: 'Debt Profile', val: data.fundamentals?.debt || 'N/A' },
    { label: 'Valuation', val: data.fundamentals?.valuation || 'N/A' },
    { label: 'Business Quality', val: data.fundamentals?.businessQuality || 'N/A' },
    { label: 'Management Quality', val: data.fundamentals?.managementQuality || 'N/A' },
  ];

  // Derive Overview string (either direct or inside details)
  const overviewText = data.companyOverview || data.details?.companyOverview || '';

  // Parse or fallback rating calculation breakdown
  const calcScore = (multiplier: number, baseMin: number) => {
    const raw = finalRating ? finalRating * multiplier : 7.0;
    const clamped = Math.min(10, Math.max(baseMin, raw));
    return clamped.toFixed(1);
  };

  const breakdown = data.ratingCalculationBreakdown || {
    financialHealth: `${calcScore(1.1, 5)}/10 (Balance Sheet)`,
    profitability: `${calcScore(1.05, 5)}/10 (Margins)`,
    growth: `${calcScore(1.0, 5)}/10 (Growth)`,
    valuation: `${calcScore(0.9, 4)}/10 (Valuation)`,
    capitalEfficiency: `${calcScore(1.02, 5)}/10 (ROE/ROCE)`,
  };

  // Capital & Investment advice defaults
  const askCapitalText =
    data.mentorInvestmentAdvice?.askUserCapital ||
    `How much total capital do you plan to invest in ${data.companyName}?`;

  const stagedExampleText =
    data.mentorInvestmentAdvice?.stagedStrategyExample ||
    `Staged Allocation Strategy Example (e.g. Total Capital ₹10,000): First invest 50% (₹5,000) at current price of ${data.currentPrice}, and add the remaining 50% (₹5,000) if price dips near the Best Buy Zone (${data.bestBuyZone || 'on 5% dip'}).`;

  const detailedPromptText =
    data.detailedInfoPrompt ||
    `If you want detailed information about ${data.companyName} (like full financial statements, technical analysis, cash flow, balance sheet, or recent news), just reply with YES!`;

  const isDetailedMode =
    detailedPromptText.includes('expanded below') ||
    detailedPromptText.includes('provided below') ||
    (data.details?.completeFinancials && data.details.completeFinancials.length > 50) ||
    !detailedPromptText.toLowerCase().includes('write yes');

  const [showMore, setShowMore] = useState(Boolean(isDetailedMode));
  const [activeTab, setActiveTab] = useState<'overview' | 'financials' | 'valuation' | 'full'>(
    isDetailedMode ? 'financials' : 'overview'
  );

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 my-3 font-sans animate-in fade-in duration-300">
      {/* DECISION CARD CONTAINER */}
      <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-5 shadow-xl space-y-5">
        
        {/* TOP HEADER BANNER: Company Name, Price, Rating, Recommendation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1F2937] pb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-extrabold text-white tracking-tight">{data.companyName}</h2>
              <span className="font-mono text-sm px-2.5 py-0.5 rounded-full bg-[#1F2937] text-sky-400 font-semibold border border-[#374151]">
                {data.currentPrice}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">15-Second AI Investment Mentor Decision Summary</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Mentor Rating Badge */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-bold text-sm ${hasRating ? getScoreColor(finalRating) : 'text-gray-300 bg-gray-500/10 border-gray-500/30'}`}>
              <Star className={`w-4 h-4 ${hasRating ? 'fill-current' : ''}`} />
              <span>Mentor Rating: {ratingLabel}</span>
            </div>

            {/* Final Action Recommendation Badge (BUY / HOLD / LEAVE) */}
            <span className={`px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider border ${getRecommendationBadge(safeRecommendation)}`}>
              {safeRecommendation}
            </span>
          </div>
        </div>

        {/* STEP 1: COMPANY OVERVIEW (2-3 Lines Only) */}
        {overviewText && (
          <div className="bg-[#0B1220] border border-[#1F2937] p-3.5 rounded-xl space-y-1 text-xs">
            <span className="text-[11px] text-sky-400 uppercase tracking-wider font-bold flex items-center gap-1.5 mb-1">
              <Building2 className="w-4 h-4 text-sky-400" /> Step 1: What is {data.companyName} Doing?
            </span>
            <p className="text-gray-200 leading-relaxed font-normal">{overviewText}</p>
          </div>
        )}

        {/* STEP 2: FUNDAMENTAL HEALTH SCORECARD (8 Cards) */}
        <div>
          <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold block mb-2.5 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" /> Step 2: Fundamental Health Scorecard
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {fundamentalItems.map((item, i) => (
              <div key={i} className="bg-[#0B1220] border border-[#1F2937] p-3 rounded-xl flex flex-col justify-between shadow-sm" title={item.val}>
                <span className="text-[10px] text-gray-400 uppercase block font-semibold tracking-wider">{item.label}</span>
                <span className="text-[11px] font-bold text-white mt-1 block leading-snug font-mono break-words">{item.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* STEP 3: MENTOR RATING CALCULATION BREAKDOWN */}
        <div className="bg-[#0B1220] border border-[#1F2937] p-3.5 rounded-xl space-y-2 text-xs">
          <span className="text-[11px] text-amber-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
            <PieChart className="w-4 h-4 text-amber-400" /> Step 3: Mentor Rating Calculation Breakdown ({ratingLabel})
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1 text-gray-300">
            <div className="bg-[#111827] p-2 rounded-lg border border-[#1F2937]">
              <span className="text-gray-400 text-[10px] block uppercase font-semibold">Financial Health</span>
              <span className="font-semibold text-white font-mono block break-words mt-0.5">{breakdown.financialHealth}</span>
            </div>
            <div className="bg-[#111827] p-2 rounded-lg border border-[#1F2937]">
              <span className="text-gray-400 text-[10px] block uppercase font-semibold">Profitability</span>
              <span className="font-semibold text-white font-mono block break-words mt-0.5">{breakdown.profitability}</span>
            </div>
            <div className="bg-[#111827] p-2 rounded-lg border border-[#1F2937]">
              <span className="text-gray-400 text-[10px] block uppercase font-semibold">Growth Trend</span>
              <span className="font-semibold text-white font-mono block break-words mt-0.5">{breakdown.growth}</span>
            </div>
            <div className="bg-[#111827] p-2 rounded-lg border border-[#1F2937]">
              <span className="text-gray-400 text-[10px] block uppercase font-semibold">Valuation Multiple</span>
              <span className="font-semibold text-white font-mono block break-words mt-0.5">{breakdown.valuation}</span>
            </div>
            <div className="bg-[#111827] p-2 rounded-lg border border-[#1F2937]">
              <span className="text-gray-400 text-[10px] block uppercase font-semibold">Capital Efficiency</span>
              <span className="font-semibold text-white font-mono block break-words mt-0.5">{breakdown.capitalEfficiency}</span>
            </div>
          </div>
        </div>

        {/* STEP 4: ACTIONABLE DECISION & TARGET BUY PRICE */}
        {(data.bestBuyZone || data.avoidAbovePrice) && (
          <div className="space-y-1.5">
            <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold block flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-sky-400" /> Step 4: Decision & Target Buy Price
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.bestBuyZone && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs">
                  <span className="text-gray-300 font-semibold flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-sky-400" /> Best Buy Zone:
                  </span>
                  <span className="font-mono font-bold text-sky-400 text-sm">{data.bestBuyZone}</span>
                </div>
              )}

              {data.avoidAbovePrice && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs">
                  <span className="text-gray-300 font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-400" /> Avoid Above:
                  </span>
                  <span className="font-mono font-bold text-red-400 text-sm">{data.avoidAbovePrice}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 5: MENTOR INVESTMENT & CAPITAL ALLOCATION ADVICE */}
        <div className="bg-[#0B1220] border border-[#1F2937] p-4 rounded-xl space-y-3 text-xs">
          <span className="text-[11px] text-sky-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
            <Wallet className="w-4 h-4 text-sky-400" /> Step 5: Mentor Capital & Investment Strategy
          </span>
          
          <div className="p-3 rounded-lg bg-[#111827] border border-[#1F2937] space-y-2">
            <div className="flex items-start gap-2">
              <MessageSquare className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-sky-300 font-bold block mb-0.5">Mentor Question to You:</strong>
                <p className="text-white font-medium">{askCapitalText}</p>
              </div>
            </div>
            
            <div className="border-t border-[#1F2937] pt-2 flex items-start gap-2 text-gray-300">
              <Sparkles className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-sky-400 font-bold block mb-0.5">Staged Allocation Plan Strategy:</strong>
                <p className="leading-relaxed text-gray-200">{stagedExampleText}</p>
              </div>
            </div>
          </div>
        </div>

        {/* KEY RISKS (Max 3 Bullets) */}
        {safeKeyRisks.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold block flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Key Risks (Top {Math.min(3, safeKeyRisks.length)})
            </span>
            <div className="space-y-1 bg-[#0B1220] border border-[#1F2937] p-3 rounded-xl text-xs text-gray-300">
              {safeKeyRisks.slice(0, 3).map((risk, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-amber-400 font-bold">•</span>
                  <span>{risk}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BOTTOM LINE SUMMARY */}
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#0B1220] to-[#1F2937] border border-[#374151] text-xs leading-relaxed text-gray-200">
          <strong className="text-sky-400 font-bold block mb-1">Mentor Bottom Line:</strong>
          {data.bottomLine}
        </div>

        {/* STEP 6: DETAILED INFO PROMPT & INTERACTIVE ACTION BUTTON */}
        {isDetailedMode ? (
          <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-500/40 text-xs text-blue-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="font-semibold">
              Detailed company analysis, complete financials, cash flow, balance sheet & news are expanded in the drawer below.
            </span>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/40 via-[#0B1220] to-[#111827] border border-blue-500/30 space-y-2 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-[11px] text-sky-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-sky-400" /> Step 6: Want Detailed Information?
              </span>
              <p className="text-gray-200">{detailedPromptText}</p>
            </div>

            <button
              onClick={() => {
                const msg = `YES, please provide detailed information about ${data.companyName} including complete financial statements, technical analysis, cash flow, balance sheet, and recent news.`;
                if (onSendPrompt) {
                  onSendPrompt(msg);
                } else {
                  navigator.clipboard.writeText(msg);
                  alert('Copied request! Paste in chat to get full details.');
                }
              }}
              className="shrink-0 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition-all hover:scale-105 flex items-center justify-center gap-1.5"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Ask Detailed Info (YES)</span>
            </button>
          </div>
        )}

        {/* Expand / Collapse "Show More" Button for Collapsible Deep Dive */}
        <div className="pt-2 flex justify-center border-t border-[#1F2937]">
          <button
            onClick={() => setShowMore(!showMore)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#1F2937] hover:bg-[#374151] text-xs font-semibold text-white border border-[#374151] transition-all hover:scale-105"
          >
            <span>{showMore ? 'Hide Advanced Analysis' : 'Show More (Full Deep-Dive Analysis)'}</span>
            {showMore ? <ChevronUp className="w-4 h-4 text-sky-400" /> : <ChevronDown className="w-4 h-4 text-sky-400" />}
          </button>
        </div>
      </div>

      {/* EXPANDABLE ADVANCED ANALYSIS DRAWER */}
      {showMore && data.details && (
        <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-5 shadow-2xl space-y-4 animate-in slide-in-from-top duration-300">
          {/* Tabs header */}
          <div className="flex items-center gap-2 border-b border-[#1F2937] pb-3 overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 ${
                activeTab === 'overview' ? 'bg-sky-500 text-white' : 'text-gray-400 hover:text-white bg-[#0B1220]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Overview
            </button>
            <button
              onClick={() => setActiveTab('financials')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 ${
                activeTab === 'financials' ? 'bg-sky-500 text-white' : 'text-gray-400 hover:text-white bg-[#0B1220]'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" /> Financials & Cash Flow
            </button>
            <button
              onClick={() => setActiveTab('valuation')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 ${
                activeTab === 'valuation' ? 'bg-sky-500 text-white' : 'text-gray-400 hover:text-white bg-[#0B1220]'
              }`}
            >
              <Activity className="w-3.5 h-3.5" /> Technicals & Valuation
            </button>
            <button
              onClick={() => setActiveTab('full')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 ${
                activeTab === 'full' ? 'bg-sky-500 text-white' : 'text-gray-400 hover:text-white bg-[#0B1220]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Full Thesis & News
            </button>
          </div>

          {/* Tab Content */}
          <div className="text-xs text-gray-300 space-y-3 leading-relaxed">
            {activeTab === 'overview' && (
              <div className="space-y-3">
                {data.details.companyOverview && (
                  <div>
                    <h4 className="font-bold text-white mb-1">Company Overview</h4>
                    <p>{data.details.companyOverview}</p>
                  </div>
                )}
                {data.details.quarterlyResults && (
                  <div>
                    <h4 className="font-bold text-white mb-1">Quarterly Results Trend</h4>
                    <p>{data.details.quarterlyResults}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'financials' && (
              <div className="space-y-3">
                {data.details.completeFinancials && (
                  <div>
                    <h4 className="font-bold text-white mb-1">Complete Financial Statements</h4>
                    <p className="whitespace-pre-wrap font-mono text-[11px] bg-[#0B1220] p-3 rounded-xl border border-[#1F2937]">{data.details.completeFinancials}</p>
                  </div>
                )}
                {data.details.cashFlow && (
                  <div>
                    <h4 className="font-bold text-white mb-1">Cash Flow Analysis</h4>
                    <p>{data.details.cashFlow}</p>
                  </div>
                )}
                {data.details.balanceSheet && (
                  <div>
                    <h4 className="font-bold text-white mb-1">Balance Sheet Breakdown</h4>
                    <p>{data.details.balanceSheet}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'valuation' && (
              <div className="space-y-3">
                {data.details.valuationDetails && (
                  <div>
                    <h4 className="font-bold text-white mb-1">Valuation Multiples</h4>
                    <p>{data.details.valuationDetails}</p>
                  </div>
                )}
                {data.details.technicalAnalysis && (
                  <div>
                    <h4 className="font-bold text-white mb-1">Technical Indicators & Support/Resistance</h4>
                    <p>{data.details.technicalAnalysis}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'full' && (
              <div className="space-y-3">
                {data.details.news && (
                  <div>
                    <h4 className="font-bold text-white mb-1 flex items-center gap-1.5">
                      <Newspaper className="w-3.5 h-3.5 text-sky-400" /> Recent Market News
                    </h4>
                    <p>{data.details.news}</p>
                  </div>
                )}
                {data.details.fullAiExplanation && (
                  <div>
                    <h4 className="font-bold text-white mb-1">Complete Mentor Thesis</h4>
                    <p className="whitespace-pre-wrap leading-relaxed">{data.details.fullAiExplanation}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
