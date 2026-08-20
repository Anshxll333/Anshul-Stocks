import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CalendarDays,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { createNewConversation } from '../api/chat';

interface IpoHubItem {
  id: number;
  companyName: string;
  symbol?: string | null;
  status?: string | null;
  ipoType?: string | null;
  currentStatus?: 'live' | 'upcoming';
  priceRange?: string | null;
  priceBand?: string | null;
  lotSize?: number | string | null;
  openDate?: string | null;
  closeDate?: string | null;
  allotmentFinalization?: string | null;
  allotmentDate?: string | null;
  listingDate?: string | null;
  gmp?: number | string | null;
  gmpGainPercent?: number | string | null;
  gmpDate?: string | null;
  totalSub?: number | string | null;
  issueSizeCr?: number | string | null;
}

const displayStatus = (ipo: IpoHubItem): 'LIVE' | 'UPCOMING' => {
  if (ipo.currentStatus === 'upcoming') return 'UPCOMING';
  return 'LIVE';
};

const fmtValue = (v: any): string => {
  if (v === null || v === undefined || v === '') return 'N/A';
  const s = String(v).trim();
  return s === '' ? 'N/A' : s;
};

const fmtPrice = (ipo: IpoHubItem): string => {
  const raw = ipo.priceRange || ipo.priceBand;
  if (raw !== null && raw !== undefined && String(raw).trim() !== '') {
    return String(raw).trim();
  }
  return 'N/A';
};

const fmtSub = (v: any): string => {
  if (v === null || v === undefined || v === '') return 'N/A';
  const n = Number(v);
  if (isNaN(n)) return String(v);
  return `${n.toFixed(2)}x`;
};

const fmtGmp = (v: any): string => {
  if (v === null || v === undefined || v === '') return 'N/A';
  const n = Number(v);
  if (isNaN(n)) return String(v);
  return `₹${n.toFixed(0)}`;
};

const fmtGmpPercent = (v: any): string => {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (isNaN(n)) return String(v);
  return `${n.toFixed(1)}%`;
};

const fmtLot = (v: any): string => {
  if (v === null || v === undefined || v === '') return 'N/A';
  const n = Number(v);
  if (isNaN(n)) return String(v);
  return `${n} shares`;
};

const isMainboard = (ipo: IpoHubItem): boolean =>
  !ipo.ipoType || String(ipo.ipoType).toLowerCase().includes('mainboard');

export const IPO: React.FC = () => {
  const navigate = useNavigate();
  const [live, setLive] = useState<IpoHubItem[]>([]);
  const [upcoming, setUpcoming] = useState<IpoHubItem[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<'mainboard' | 'all'>('mainboard');

  const fetchIpos = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/market/ipo');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const rows: any[] = json?.success && Array.isArray(json.data) ? json.data : [];
      setLive(rows.filter((r) => r.currentStatus === 'live'));
      setUpcoming(rows.filter((r) => r.currentStatus === 'upcoming'));
      // Real freshness = the backend's lastSyncedAt (last successful DB sync),
      // NOT the API response generation time.
      const syncStamp = json?.meta?.lastSyncedAt || json?.meta?.generatedAt || null;
      if (syncStamp) {
        const d = new Date(syncStamp);
        if (!isNaN(d.getTime())) {
          setLastUpdated(
            d.toLocaleString('en-IN', {
              timeZone: 'Asia/Kolkata',
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            }),
          );
          // The scheduler runs hourly — a last sync older than 2h means the
          // provider has been failing and the shown data is cached, not live.
          setIsStale(Date.now() - d.getTime() > 2 * 60 * 60 * 1000);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch live IPO data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Refresh = run the existing backend sync (POST /api/debug/ipo-sync →
  // IpoSyncService.syncIpos against the live provider), then re-read the
  // PostgreSQL-backed list. If the provider is down, the cached rows remain
  // visible and are flagged as stale via lastSyncedAt.
  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const syncRes = await fetch('/api/debug/ipo-sync', { method: 'POST' });
      const syncJson = syncRes.ok
        ? await syncRes.json().catch(() => null)
        : null;
      const syncStatus: string | null = syncJson?.result?.status ?? null;
      await fetchIpos(true);
      if (syncStatus && syncStatus !== 'success') {
        setError(
          syncStatus === 'no-data'
            ? 'Live provider returned no data — showing last cached data.'
            : 'Live provider sync failed — showing last cached data.',
        );
      }
    } catch {
      await fetchIpos(true);
    }
  };

  useEffect(() => {
    fetchIpos();
  }, []);

  const askMentorAbout = async (ipo: IpoHubItem) => {
    const newConv = await createNewConversation(`IPO Analysis: ${ipo.companyName}`);
    const name = ipo.companyName;
    const symbol = ipo.symbol || '';
    navigate('/chat', {
      state: {
        initialPrompt: `You are my IPO Mentor. Analyze the ${name}${symbol ? ` (${symbol})` : ''} IPO in detail using only real market data: DRHP summary, company overview, issue details & price band, financial trajectory, valuation vs peers, subscription status, GMP, and key risks / red flags. Then give a clear verdict — should I APPLY or AVOID this IPO?`,
        forceNewChat: true,
        conversationId: newConv?.id,
      },
    });
  };

  const renderCard = (ipo: IpoHubItem) => {
    const isLive = ipo.currentStatus === 'live';
    const statusLabel = displayStatus(ipo);
    return (
      <div
        key={ipo.id ?? ipo.companyName}
        className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-sm transition-shadow hover:shadow-md"
      >
        {/* Header row: name + status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
              <Building2 className="h-4.5 w-4.5" />
            </div>
            <h3
              className="text-base font-bold leading-snug text-white"
              style={{ textShadow: '0 1px 3px rgba(0, 0, 0, 0.85)' }}
            >
              {fmtValue(ipo.companyName)}
            </h3>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${
              isLive
                ? 'bg-sky-500/10 text-sky-400'
                : 'bg-blue-500/10 text-blue-300'
            }`}
          >
            {statusLabel}
          </span>
        </div>

        {/* Lot Size / Price / GMP / Subscription */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Lot Size</p>
            <p className="mt-0.5 text-sm font-medium text-[var(--text-primary)]">{fmtLot(ipo.lotSize)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Price Range</p>
            <p className="mt-0.5 text-sm font-medium text-[var(--text-primary)]">{fmtPrice(ipo)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">GMP</p>
            <p className="mt-0.5 text-sm font-medium text-[var(--text-primary)]">
              {fmtGmp(ipo.gmp)}
              {ipo.gmp && ipo.gmpGainPercent ? (
                <span className="ml-1.5 text-xs font-semibold text-sky-400">
                  +{fmtGmpPercent(ipo.gmpGainPercent)}
                </span>
              ) : null}
            </p>
            {ipo.gmp && ipo.gmpDate ? (
              <p className="text-[10px] text-[var(--text-muted)]">as of {ipo.gmpDate}</p>
            ) : null}
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Subscription</p>
            <p className="mt-0.5 text-sm font-medium text-[var(--text-primary)]">{fmtSub(ipo.totalSub)}</p>
          </div>
        </div>

        {/* Timeline */}
        <div className="rounded-lg border border-[var(--border)] bg-black/20 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <CalendarDays className="h-3.5 w-3.5 text-[var(--accent)]" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              IPO Timeline
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Open</p>
              <p className="mt-0.5 text-xs font-medium text-[var(--text-primary)]">{fmtValue(ipo.openDate)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Close</p>
              <p className="mt-0.5 text-xs font-medium text-[var(--text-primary)]">{fmtValue(ipo.closeDate)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Allotment</p>
              <p className="mt-0.5 text-xs font-medium text-[var(--text-primary)]">
                {fmtValue(ipo.allotmentFinalization || ipo.allotmentDate)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Listing</p>
              <p className="mt-0.5 text-xs font-medium text-[var(--text-primary)]">{fmtValue(ipo.listingDate)}</p>
            </div>
          </div>
        </div>

        {/* Ask IPO Mentor */}
        <button
          onClick={() => askMentorAbout(ipo)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-2 text-sm font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/20"
        >
          <Sparkles className="h-4 w-4" />
          Ask IPO Mentor
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  };

  const renderSection = (items: IpoHubItem[], emptyMessage: string) => {
    if (items.length === 0) {
      return (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 text-center">
          <p className="text-sm text-[var(--text-muted)]">{emptyMessage}</p>
        </div>
      );
    }
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((ipo) => renderCard(ipo))}
      </div>
    );
  };

    const visibleLive = typeFilter === 'all' ? live : live.filter(isMainboard);
    const visibleUpcoming =
      typeFilter === 'all' ? upcoming : upcoming.filter(isMainboard);
    const smeCount =
      live.filter((i) => !isMainboard(i)).length +
      upcoming.filter((i) => !isMainboard(i)).length;

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent)] mb-2">
            <Building2 className="w-4 h-4" /> IPO Hub
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">
            Current IPOs
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Live and upcoming IPOs with real market data — updated from the live provider.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-[var(--text-muted)]">
              {isStale ? 'Cached' : 'Data synced'} {lastUpdated} IST
            </span>
          )}
          {isStale && (
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-400">
              Stale
            </span>
          )}
          <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-1">
            {(['mainboard', 'all'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  typeFilter === t
                    ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {t === 'mainboard' ? 'Mainboard' : 'All'}
              </button>
            ))}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--accent)]/50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Syncing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {typeFilter === 'mainboard' && smeCount > 0 && (
        <p className="text-xs text-[var(--text-muted)]">
          Showing <strong className="text-[var(--text-primary)]">Mainboard</strong> IPOs only.
          Switch to “All” to include {smeCount} SME IPO{smeCount === 1 ? '' : 's'}.
        </p>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
          <p className="text-sm text-[var(--text-muted)]">Loading current IPOs…</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-400" />
          <p className="mt-2 text-sm text-[var(--text-primary)]">{error}</p>
          <button
            onClick={() => fetchIpos(true)}
            className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--accent)]/50"
          >
            Try Again
          </button>
        </div>
      )}

      {/* LIVE IPOs */}
      {!loading && !error && (
        <>
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Live IPOs</h2>
              <span className="rounded-full bg-[var(--border)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                {visibleLive.length}
              </span>
            </div>
            {renderSection(
              visibleLive,
              visibleLive.length === 0 && visibleUpcoming.length === 0
                ? 'No IPOs currently open.'
                : 'No IPOs currently open.',
            )}
          </section>

          {/* UPCOMING IPOs */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Upcoming IPOs</h2>
              <span className="rounded-full bg-[var(--border)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                {visibleUpcoming.length}
              </span>
            </div>
            {renderSection(
              visibleUpcoming,
              visibleUpcoming.length === 0 ? 'No reliable upcoming IPOs right now.' : 'No reliable upcoming IPOs right now.',
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default IPO;
