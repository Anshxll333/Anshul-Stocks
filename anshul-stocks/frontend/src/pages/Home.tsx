import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sparkles, Building2, UploadCloud, ArrowRight, Star, Search, Scale, FileText } from 'lucide-react';
import { apiClient } from '../api/client';

interface HomeIpoItem {
  id: number;
  companyName: string;
  symbol?: string | null;
  ipoType?: string | null;
  currentStatus?: 'live' | 'upcoming';
  priceRange?: string | null;
  priceBand?: string | null;
  gmp?: number | string | null;
  gmpGainPercent?: number | string | null;
  totalSub?: number | string | null;
  openDate?: string | null;
  closeDate?: string | null;
}

const fmtGmp = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return 'N/A';
  const n = Number(v);
  if (isNaN(n)) return String(v);
  return `₹${n.toFixed(0)}`;
};

const fmtGmpPercent = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (isNaN(n)) return String(v);
  return `${n.toFixed(1)}%`;
};

const fmtSub = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return 'N/A';
  const n = Number(v);
  if (isNaN(n)) return String(v);
  return `${n.toFixed(2)}x`;
};

const fmtPrice = (ipo: HomeIpoItem): string => {
  const raw = ipo.priceRange || ipo.priceBand;
  if (raw !== null && raw !== undefined && String(raw).trim() !== '') {
    return String(raw).trim();
  }
  return 'N/A';
};

const fmtCloseDate = (v: unknown): string => {
  if (v === null || v === undefined || String(v).trim() === '') return 'N/A';
  return String(v).trim();
};

const isMainboard = (ipo: HomeIpoItem): boolean =>
  !ipo.ipoType || String(ipo.ipoType).toLowerCase().includes('mainboard');

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [liveIpos, setLiveIpos] = useState<HomeIpoItem[]>([]);
  const [ipoLoading, setIpoLoading] = useState(true);

  const promptPills = [
    { text: '🔥 Should I apply for Swiggy IPO?', icon: Building2 },
    { text: '📊 Analyze Reliance Industries fundamentals', icon: Star },
    { text: '📸 Analyze broker screenshot (Groww/Zerodha)', icon: UploadCloud },
    { text: '⚔️ Compare TCS vs Infosys valuation', icon: Scale },
    { text: '📑 Summarize NTPC Green DRHP risks', icon: FileText },
  ];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get('/market/ipo');
        const json: { success?: boolean; data?: unknown } = res.data;
        if (cancelled) return;
        const rows = (Array.isArray(json?.data) ? json.data : []) as HomeIpoItem[];
        const live = rows
          .filter((r) => r.currentStatus === 'live' && isMainboard(r))
          .sort((a, b) =>
            String(a.openDate || '').localeCompare(String(b.openDate || '')),
          )
          .slice(0, 3);
        setLiveIpos(live);
      } catch {
        if (!cancelled) setLiveIpos([]);
      } finally {
        if (!cancelled) setIpoLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    navigate('/chat', { state: { initialPrompt: prompt.trim(), forceNewChat: true } });
  };

  const handlePillClick = (text: string) => {
    if (text.includes('screenshot')) {
      navigate('/upload');
    } else {
      navigate('/chat', { state: { initialPrompt: text, forceNewChat: true } });
    }
  };

  const askMentorAbout = (ipo: HomeIpoItem) => {
    const name = ipo.companyName;
    const symbol = ipo.symbol || '';
    navigate('/chat', {
      state: {
        initialPrompt: `You are my IPO Mentor. Analyze the ${name}${symbol ? ` (${symbol})` : ''} IPO in detail using only real market data: DRHP summary, company overview, issue details & price band, financial trajectory, valuation vs peers, subscription status, GMP, and key risks / red flags. Then give a clear verdict — should I APPLY or AVOID this IPO?`,
        forceNewChat: true,
      },
    });
  };

  return (
    <div className="flex-1 w-full pb-16">
      {/* Hero — full-screen video background (dashboard only) */}
      <section className="relative w-full overflow-hidden">
        {/* Background video */}
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src="/dashboard-bg.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
        />

        {/* Dark navy gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#050A14]/95 via-[#060D1C]/85 to-[#050A14]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(37,99,235,0.22),transparent_62%)]" />

        {/* Centered hero content — fills exactly the first viewport beneath the header (h-16 = 4rem), so the Current IPO section stays below the fold */}
        <div className="relative z-10 min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center text-center max-w-5xl mx-auto px-6 py-16">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-[1.1] tracking-tight max-w-3xl mx-auto mb-7">
            Your Personal <span className="text-sky-400">IPO & Stock</span> Research Mentor
          </h1>

          {/* AI Input Box */}
          <div className="w-full max-w-2xl mx-auto mb-8">
            <form onSubmit={handlePromptSubmit} className="relative">
              <div className="relative bg-[#0B1424]/85 border border-[#2C3E5F] rounded-2xl p-3 flex items-center shadow-xl backdrop-blur-sm transition-all hover:border-sky-400/50 focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-400/30">
                <Search className="w-5 h-5 text-gray-400 ml-3 mr-3 shrink-0" />
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ask about any IPO, Stock, GMP, or paste financial query..."
                  className="w-full bg-transparent text-white placeholder:text-gray-400 caret-sky-400 text-base focus:outline-none"
                />
                <button
                  type="submit"
                  className="btn-primary text-sm py-2.5 px-5 ml-2 shrink-0 flex items-center gap-2"
                >
                  <span>Ask Mentor</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>

          {/* Prompt Suggestion Pills */}
          <div className="flex flex-wrap justify-center gap-2.5 max-w-3xl mx-auto">
            {promptPills.map((pill, i) => {
              const Icon = pill.icon;
              return (
                <button
                  key={i}
                  onClick={() => handlePillClick(pill.text)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0B1424]/80 border border-[var(--border)] text-xs font-medium text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-subtle)] hover:border-sky-400/40 transition-all cursor-pointer shadow-sm backdrop-blur-sm"
                >
                  <Icon className="w-3.5 h-3.5 text-sky-400" />
                  <span>{pill.text}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Current IPO Section — live Mainboard IPOs from the existing backend API */}
      <section className="max-w-6xl mx-auto px-6 pt-16">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-400" />
            </span>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Current IPO
            </h2>
          </div>
          <Link
            to="/ipo"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors"
          >
            View all in IPO Hub
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {ipoLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 animate-pulse">
                <div className="h-4 w-2/3 rounded bg-[#16233B]" />
                <div className="h-3 w-full rounded bg-[#16233B] mt-4" />
                <div className="h-3 w-3/4 rounded bg-[#16233B] mt-2" />
              </div>
            ))}
          </div>
        ) : liveIpos.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 text-center">
            <p className="text-sm text-[var(--text-muted)]">
              No live Mainboard IPOs right now — check the IPO Hub.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {liveIpos.map((ipo) => (
              <div
                key={ipo.id ?? ipo.companyName}
                className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]/80 p-5 shadow-sm transition-all backdrop-blur-sm hover:border-sky-400/50 hover:shadow-[0_0_22px_rgba(56,189,248,0.18)]"
              >
                {/* Company name + LIVE badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-400/10 text-sky-400">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-bold leading-snug text-white truncate">
                      {ipo.companyName}
                    </h3>
                  </div>
                  <span className="shrink-0 rounded-full bg-sky-500/10 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-sky-400">
                    LIVE
                  </span>
                </div>

                {/* Price / GMP / Subscription / Close date */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Price Range</p>
                    <p className="mt-0.5 text-xs font-medium text-[var(--text-primary)]">{fmtPrice(ipo)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">GMP</p>
                    <p className="mt-0.5 text-xs font-medium text-[var(--text-primary)]">
                      {fmtGmp(ipo.gmp)}
                      {ipo.gmp && ipo.gmpGainPercent ? (
                        <span className="ml-1 text-[11px] font-semibold text-sky-400">
                          +{fmtGmpPercent(ipo.gmpGainPercent)}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Subscription</p>
                    <p className="mt-0.5 text-xs font-medium text-[var(--text-primary)]">{fmtSub(ipo.totalSub)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Close Date</p>
                    <p className="mt-0.5 text-xs font-medium text-[var(--text-primary)]">{fmtCloseDate(ipo.closeDate)}</p>
                  </div>
                </div>

                {/* Ask IPO Mentor — same flow as IPO Hub */}
                <button
                  onClick={() => askMentorAbout(ipo)}
                  className="mt-auto flex w-full items-center justify-center gap-2 rounded-lg border border-sky-400/40 bg-sky-400/10 px-3 py-2 text-xs font-medium text-sky-400 transition-colors hover:bg-sky-400/20"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Ask IPO Mentor
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Home;
