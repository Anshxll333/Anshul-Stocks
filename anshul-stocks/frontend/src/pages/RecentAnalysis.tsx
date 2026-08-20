import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Image as ImageIcon, MessageSquare, CheckCircle, ArrowRight, Filter, RefreshCw, AlertCircle } from 'lucide-react';

const RecentAnalysis: React.FC = () => {
  const navigate = useNavigate();
  const [filterType, setFilterType] = useState<string>('all');
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/chat/history');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setHistoryItems(json.data);
      } else {
        setHistoryItems([]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load recent analysis records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const filtered = filterType === 'all' ? historyItems : historyItems.filter((i) => i.type === filterType);

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-10">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-[var(--border)]">
        <div>
          <h1 className="text-4xl font-[var(--font-fraunces)] font-normal tracking-tight text-[var(--text-primary)] flex items-center gap-3">
            <History className="w-8 h-8 text-[var(--accent)]" />
            <span>Recent AI Analyses</span>
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mt-3 max-w-2xl leading-relaxed">
            Review your real conversation records, DRHP dissections, and stock reports.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <button
            onClick={fetchHistory}
            className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-[var(--bg-subtle)] transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Refresh Records
          </button>
          {/* Filter Buttons */}
          <div className="flex items-center gap-1.5 bg-[var(--bg-surface)] border border-[var(--border)] p-1.5 rounded-xl text-sm shadow-sm">
            <Filter className="w-4 h-4 text-[var(--text-muted)] ml-2" />
            {['all', 'screenshot', 'stock', 'ipo'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-lg capitalize font-medium transition-colors ${
                  filterType === type
                    ? 'bg-[var(--bg-base)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* History Grid */}
      <div className="space-y-6">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-[var(--bg-subtle)] rounded-2xl p-6 space-y-3">
                <div className="h-5 w-1/3 bg-[var(--bg-surface)] rounded-md"></div>
                <div className="h-4 w-3/4 bg-[var(--bg-surface)] rounded-md"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="premium-card text-center py-16 space-y-4">
            <AlertCircle className="w-12 h-12 text-[var(--danger)] mx-auto" />
            <h3 className="text-xl font-bold text-[var(--text-primary)]">History Notice</h3>
            <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">{error}</p>
            <button onClick={fetchHistory} className="btn-ghost inline-flex items-center gap-2 mt-2">
              <RefreshCw className="w-4 h-4" /> Try Reloading
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="premium-card text-center py-16 space-y-4">
            <History className="w-12 h-12 text-[var(--text-muted)] mx-auto" />
            <h3 className="text-xl font-bold text-[var(--text-primary)]">No Past Analysis Records Found</h3>
            <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">
              You haven't initiated any AI stock evaluations or screenshot dissections yet. Start a new session with the AI Investment Mentor to build your research archive.
            </p>
            <button
              onClick={() => navigate('/chat')}
              className="btn-primary inline-flex items-center gap-2 mt-2"
            >
              <span>Launch AI Mentor Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          filtered.map((item, idx) => (
            <div
              key={item.id || idx}
              onClick={() => navigate('/chat', { state: { conversationId: item.id } })}
              className="list-row cursor-pointer group space-y-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-sm group-hover:scale-105 transition-transform">
                    {item.type === 'screenshot' ? (
                      <ImageIcon className="w-6 h-6 text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors" />
                    ) : (
                      <MessageSquare className="w-6 h-6 text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                      {item.title}
                    </h3>
                    <span className="text-xs text-[var(--text-secondary)] font-mono">{item.date}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--success)]/10 border border-[var(--success)]/20 text-[var(--success)] text-xs font-semibold shrink-0">
                  <CheckCircle className="w-4 h-4" />
                  <span>{item.status || 'Completed'}</span>
                </div>
              </div>

              <p className="text-sm text-[var(--text-secondary)] bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border)] leading-relaxed shadow-sm">
                {item.summary}
              </p>

              <div className="flex items-center justify-end text-sm text-[var(--text-secondary)] font-medium group-hover:text-[var(--accent)] group-hover:translate-x-1 transition-all gap-1.5">
                <span>Resume Conversation</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RecentAnalysis;
