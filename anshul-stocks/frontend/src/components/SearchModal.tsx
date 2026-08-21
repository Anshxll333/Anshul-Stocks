import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Sparkles, Clock, ArrowRight, Building2 } from 'lucide-react';
import { apiClient } from '../api/client';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  
  const [activeIpos, setActiveIpos] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('anshul_recent_searches');
    if (saved) {
      try { setRecentSearches(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      apiClient.get('/market/ipo')
        .then(res => {
          const data = res.data;
          if (data && data.success && Array.isArray(data.data)) {
            setActiveIpos(data.data.slice(0, 4));
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle live query search
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      apiClient.get(`/market/search?q=${encodeURIComponent(query.trim())}`)
        .then(res => {
          const data = res.data;
          if (data && data.success && Array.isArray(data.data)) {
            setSearchResults(data.data);
          } else {
            setSearchResults([]);
          }
        })
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const saveRecent = (term: string) => {
    const updated = [term, ...recentSearches.filter(i => i !== term)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('anshul_recent_searches', JSON.stringify(updated));
  };

  const handleSelectStock = (symbol: string) => {
    saveRecent(symbol);
    onClose();
    navigate(`/company/${symbol}`);
  };

  const handleSelectTopic = (prompt: string) => {
    saveRecent(prompt);
    onClose();
    navigate('/chat', { state: { initialPrompt: prompt } });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    saveRecent(query.trim());
    onClose();
    const clean = query.trim().toUpperCase();
    const isTicker = /^[A-Z0-9^.]{2,12}$/.test(clean);
    if (isTicker && !clean.includes(' ')) {
      navigate(`/company/${clean}`);
    } else {
      navigate('/chat', { state: { initialPrompt: query.trim() } });
    }
  };

  const filteredIpos = query
    ? activeIpos.filter(i => (i.name || i.companyName || '').toLowerCase().includes(query.toLowerCase()))
    : activeIpos;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-[var(--bg-base)]/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="w-full max-w-2xl bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Search Bar */}
        <form onSubmit={handleFormSubmit} className="flex items-center px-4 py-3.5 border-b border-[#1F2937] bg-[#111827]">
          <Search className="w-5 h-5 text-gray-400 mr-3 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search live tickers (e.g. RELIANCE), IPOs, or ask AI..."
            className="w-full bg-transparent text-white placeholder:text-gray-400 caret-sky-400 focus:outline-none text-base"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-2 px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] rounded-md border border-[var(--border)] transition-colors"
          >
            ESC
          </button>
        </form>

        {/* Results Content Area */}
        <div className="overflow-y-auto p-4 space-y-6 bg-[var(--bg-surface)]">
          {/* Recent Searches */}
          {!query && recentSearches.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Recent Searches
                </span>
                <button
                  onClick={() => { setRecentSearches([]); localStorage.removeItem('anshul_recent_searches'); }}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Clear all
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((term, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      const clean = term.toUpperCase();
                      if (/^[A-Z0-9^.]{2,12}$/.test(clean) && !clean.includes(' ')) {
                        handleSelectStock(clean);
                      } else {
                        handleSelectTopic(term);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-subtle)] hover:bg-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm font-medium transition-colors"
                  >
                    <span>{term}</span>
                    <ArrowRight className="w-3 h-3 text-[var(--text-muted)]" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Live Search Results from API */}
          {query && query.trim().length >= 2 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5" /> {searching ? 'Searching Live Feeds...' : 'Live Exchange Matches'}
                </span>
              </div>
              {searchResults.length > 0 ? (
                <div className="grid grid-cols-1 gap-1">
                  {searchResults.slice(0, 8).map((res, i) => (
                    <div
                      key={res.symbol || i}
                      onClick={() => handleSelectStock(res.symbol || res.ticker)}
                      className="flex items-center justify-between p-3 rounded-xl hover:bg-[var(--bg-subtle)] cursor-pointer transition-colors group"
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[var(--text-primary)] text-sm">
                            {res.symbol || res.ticker}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
                            {res.exchange || 'NSE/BSE'}
                          </span>
                        </div>
                        <span className="text-xs text-[var(--text-secondary)] truncate">{res.name || res.longname || res.shortname}</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors shrink-0" />
                    </div>
                  ))}
                </div>
              ) : !searching ? (
                <p className="text-sm text-[var(--text-secondary)] p-4 rounded-xl bg-[var(--bg-subtle)]">
                  No direct company symbol match in live search for "{query}". Try selecting a topic or asking AI below.
                </p>
              ) : null}
            </div>
          )}



          {/* IPOs Section */}
          {!query && activeIpos.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> Live IPO Filings
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredIpos.map((ipo, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectTopic(`Tell me about ${ipo.name || ipo.companyName}, valuation, risks and should I apply?`)}
                    className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-subtle)] hover:bg-[var(--border)] cursor-pointer transition-colors group"
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="font-medium text-[var(--text-primary)] text-sm truncate">
                        {ipo.name || ipo.companyName}
                      </span>
                      <span className="text-xs text-[var(--text-secondary)]">{ipo.status || 'Active Filing'}</span>
                    </div>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--bg-surface)] text-[var(--text-primary)] shrink-0">
                      {ipo.gmp || 'Live'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}



          {query && searchResults.length === 0 && !searching && (
            <div className="text-center py-8">
              <p className="text-[var(--text-secondary)] text-sm mb-4">Ask our AI Mentor for detailed research on "{query}".</p>
              <button
                onClick={() => handleSelectTopic(query)}
                className="btn-primary text-sm py-2 px-6"
              >
                <Sparkles className="w-4 h-4" /> <span>Launch AI Investment Mentor</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-3 bg-[var(--bg-subtle)] border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <span>Tip: Type a stock ticker (e.g. <strong className="text-[var(--text-primary)] font-medium">TCS</strong>) for instant fundamentals.</span>
          <span className="hidden sm:inline">Press <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] font-medium">ESC</kbd> to close</span>
        </div>
      </div>
    </div>
  );
};

export default SearchModal;
