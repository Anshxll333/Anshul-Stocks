import React, { useState } from 'react';
import { Star, ShieldAlert, ChevronDown, ChevronUp, Building2, TrendingUp, Layers, CheckCircle2 } from 'lucide-react';

export interface IpoDecisionData {
  type: 'ipo';
  companyName: string;
  ipoRating: number;
  gmp: string;
  subscription: string;
  listingProbability: string;
  recommendation: 'Apply' | 'Avoid' | string;
  riskLevel: 'Low' | 'Moderate' | 'High' | string;
  finalVerdict: string;
  details?: {
    issueDetails?: string;
    retailAllocation?: string;
    drhpSummary?: string;
    financials?: string;
    keyRisks?: string;
    fullAiExplanation?: string;
  };
}

export const IpoDecisionCard: React.FC<{ data: IpoDecisionData }> = ({ data }) => {
  const [showMore, setShowMore] = useState(false);

  // ── Defensive field guards: AI content can arrive with missing/malformed
  //    fields. Rendering must NEVER throw (an uncaught render error without an
  //    error boundary blanked the whole app). ──
  const safeRecommendation = typeof data.recommendation === 'string' ? data.recommendation : 'Avoid';
  const safeRiskLevel = typeof data.riskLevel === 'string' ? data.riskLevel : 'Moderate';
  const safeRating = Number(data.ipoRating);
  const hasRating = Number.isFinite(safeRating) && safeRating > 0;
  const finalRating = hasRating ? safeRating : 0;
  const ratingLabel = hasRating ? `${finalRating} / 10` : 'Not available';
  const riskUnavailable =
    !safeRiskLevel ||
    ['', 'not available', 'n/a', 'na', 'unavailable', 'cannot be determined'].includes(
      safeRiskLevel.trim().toLowerCase(),
    );

  const isApply = safeRecommendation.toLowerCase().includes('apply');

  const getRiskBadge = (risk: string) => {
    const clean = (risk || '').toLowerCase();
    if (clean.includes('low')) return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
    if (clean.includes('mod')) return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    return 'bg-red-500/10 text-red-400 border-red-500/30';
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 my-3 font-sans animate-in fade-in duration-300">
      {/* 15-SECOND IPO DECISION CARD */}
      <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-5 shadow-xl space-y-5">
        {/* Top Banner: Company Name, Rating, Apply/Avoid Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1F2937] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-sky-400" />
              <h2 className="text-2xl font-extrabold text-white tracking-tight">{data.companyName}</h2>
            </div>
            <p className="text-xs text-gray-400 mt-1">15-Second IPO Application Decision Summary</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Rating Badge */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-bold text-sm ${hasRating ? 'border-sky-500/30 bg-sky-500/10 text-sky-400' : 'text-gray-300 bg-gray-500/10 border-gray-500/30'}`}>
              <Star className={`w-4 h-4 ${hasRating ? 'fill-current' : ''}`} />
              <span>{ratingLabel}</span>
            </div>

            {/* Recommendation Badge */}
            <span className={`px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider border shadow-md ${
              isApply
                ? 'bg-sky-500 text-white border-sky-400 shadow-sky-500/20'
                : 'bg-red-500 text-white border-red-400'
            }`}>
              {safeRecommendation}
            </span>
          </div>
        </div>

        {/* 4 Core Metric Chips: GMP, Subscription, Listing Probability, Risk Level */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#0B1220] border border-[#1F2937] p-3 rounded-xl">
            <span className="text-[10px] text-gray-400 uppercase block font-medium">GMP</span>
            <span className="text-sm font-bold text-sky-400 font-mono mt-0.5 block">{data.gmp || 'Not available'}</span>
          </div>

          <div className="bg-[#0B1220] border border-[#1F2937] p-3 rounded-xl">
            <span className="text-[10px] text-gray-400 uppercase block font-medium">Subscription</span>
            <span className="text-sm font-bold text-white font-mono mt-0.5 block">{data.subscription || 'Not available'}</span>
          </div>

          <div className="bg-[#0B1220] border border-[#1F2937] p-3 rounded-xl">
            <span className="text-[10px] text-gray-400 uppercase block font-medium">Listing Gain Prob.</span>
            <span className="text-sm font-bold text-sky-400 font-mono mt-0.5 block">{data.listingProbability || 'Not available'}</span>
          </div>

          <div className="bg-[#0B1220] border border-[#1F2937] p-3 rounded-xl">
            <span className="text-[10px] text-gray-400 uppercase block font-medium">Risk Profile</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded border inline-block mt-1 ${riskUnavailable ? 'bg-gray-500/10 text-gray-300 border-gray-500/30' : getRiskBadge(safeRiskLevel)}`}>
              {riskUnavailable ? 'Not available' : `${safeRiskLevel} Risk`}
            </span>
          </div>
        </div>

        {/* Final Verdict (2-3 Sentences) */}
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#0B1220] to-[#1F2937] border border-[#374151] text-xs leading-relaxed text-gray-200">
          <strong className="text-sky-400 font-bold block mb-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" /> Final Mentor Verdict:
          </strong>
          {data.finalVerdict || 'Not available'}
        </div>

        {/* Expand / Collapse "Show More" Button */}
        <div className="pt-2 flex justify-center border-t border-[#1F2937]">
          <button
            onClick={() => setShowMore(!showMore)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#1F2937] hover:bg-[#374151] text-xs font-semibold text-white border border-[#374151] transition-all hover:scale-105"
          >
            <span>{showMore ? 'Hide DRHP Details' : 'Show More (Full DRHP & Financials)'}</span>
            {showMore ? <ChevronUp className="w-4 h-4 text-sky-400" /> : <ChevronDown className="w-4 h-4 text-sky-400" />}
          </button>
        </div>
      </div>

      {/* EXPANDABLE DRHP DETAILS DRAWER */}
      {showMore && data.details && (
        <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-5 shadow-2xl space-y-4 text-xs text-gray-300 leading-relaxed animate-in slide-in-from-top duration-300">
          {data.details.issueDetails && (
            <div>
              <h4 className="font-bold text-white mb-1 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-sky-400" /> Issue Details & Price Band
              </h4>
              <p>{data.details.issueDetails}</p>
            </div>
          )}

          {data.details.drhpSummary && (
            <div>
              <h4 className="font-bold text-white mb-1">Company Overview & Objects of Issue</h4>
              <p>{data.details.drhpSummary}</p>
            </div>
          )}

          {data.details.financials && (
            <div>
              <h4 className="font-bold text-white mb-1">Financial Trajectory (Revenue & Profit)</h4>
              <p>{data.details.financials}</p>
            </div>
          )}

          {data.details.keyRisks && (
            <div>
              <h4 className="font-bold text-white mb-1 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-red-400" /> Key DRHP Risk Factors
              </h4>
              <p>{data.details.keyRisks}</p>
            </div>
          )}

          {data.details.fullAiExplanation && (
            <div>
              <h4 className="font-bold text-white mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-400" /> Detailed AI Mentor Analysis
              </h4>
              <p className="whitespace-pre-wrap">{data.details.fullAiExplanation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
