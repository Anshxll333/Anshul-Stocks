import React from 'react';
import { Building2, CalendarDays } from 'lucide-react';

export interface IpoListItem {
  companyName: string;
  symbol: string;
  status: string;
  priceBand: string;
  lotSize: string;
  issueSizeCr: string;
  openDate: string;
  closeDate: string;
  gmp: string;
  subscription: string;
}

export interface IpoListData {
  type: 'ipo_list';
  items: IpoListItem[];
}

export const IpoListCard: React.FC<{ data: IpoListData }> = ({ data }) => {
  if (!data.items || data.items.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto my-3 p-5 rounded-2xl bg-[#111827] border border-[#1F2937] shadow-xl text-center text-gray-400">
        No current IPOs found.
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('live') || s.includes('open')) {
      return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
    }
    if (s.includes('upcoming')) {
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    }
    return 'bg-gray-500/10 text-gray-300 border-gray-500/30';
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 my-3 font-sans animate-in fade-in duration-300">
      <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2 border-b border-[#1F2937] pb-4">
          <Building2 className="w-5 h-5 text-sky-400" />
          <h2 className="text-xl font-extrabold text-white tracking-tight">Current IPOs</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {data.items.map((ipo, idx) => (
            <div key={idx} className="bg-[#0B1220] border border-[#1F2937] rounded-xl p-4 flex flex-col gap-3 hover:border-sky-500/30 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white leading-tight">{ipo.companyName || 'Unknown Company'}</h3>
                  {ipo.symbol && ipo.symbol !== 'Not available' && (
                    <span className="text-[10px] text-gray-500 font-mono mt-0.5 block">{ipo.symbol}</span>
                  )}
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${getStatusBadge(ipo.status)}`}>
                  {ipo.status || 'Unknown'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-1">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase block font-medium">Price Band</span>
                  <span className="text-xs font-bold text-white font-mono mt-0.5 block">{ipo.priceBand || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase block font-medium">Issue Size</span>
                  <span className="text-xs font-bold text-white font-mono mt-0.5 block">{ipo.issueSizeCr || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase block font-medium">GMP</span>
                  <span className="text-xs font-bold text-sky-400 font-mono mt-0.5 block">{ipo.gmp || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase block font-medium">Subscription</span>
                  <span className="text-xs font-bold text-white font-mono mt-0.5 block">{ipo.subscription || 'N/A'}</span>
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-[#1F2937] flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1.5 text-gray-400">
                  <CalendarDays className="w-3.5 h-3.5 text-sky-400/70" />
                  <span>Open: <strong className="text-gray-300">{ipo.openDate || 'N/A'}</strong></span>
                </div>
                <div className="text-gray-400">
                  Close: <strong className="text-gray-300">{ipo.closeDate || 'N/A'}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
