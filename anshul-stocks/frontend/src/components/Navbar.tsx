import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sparkles, User, Menu, X, Search, Sun, Moon, Building2, UploadCloud, History, Home as HomeIcon } from 'lucide-react';
import { Logo } from './Logo';
import { SearchModal } from './SearchModal';
import { useTheme } from '../App';

const Navbar: React.FC = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { darkMode, toggleDarkMode } = useTheme();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navLinks = [
    { name: 'Home', path: '/', icon: HomeIcon },
    { name: 'Ask Mentor', path: '/chat', icon: Sparkles },
    { name: 'IPO Hub', path: '/ipo', icon: Building2 },
    { name: 'Screenshot Analyzer', path: '/upload', icon: UploadCloud },
    { name: 'History', path: '/analysis', icon: History },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <nav className="sticky top-0 z-50 bg-[#060D1C]/95 backdrop-blur-md border-b border-[#1C2A44] shadow-sm shadow-black/30 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="flex items-center justify-between h-16 gap-6">
            {/* Brand — visually stronger than nav links */}
            <Link to="/" className="flex items-center group shrink-0">
              <Logo size="lg" showText={true} showTagline={false} />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1 flex-1 justify-center">
              {navLinks.map((link) => {
                const active = isActive(link.path);
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    state={link.path === '/chat' ? { forceNewChat: true } : undefined}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 ${
                      active
                        ? 'text-white bg-white/5 border border-[var(--border)]'
                        : 'text-[var(--text-secondary)] border border-transparent hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              })}
            </div>

            {/* Right Action Controls */}
            <div className="hidden sm:flex items-center gap-2.5 shrink-0">
              <button
                onClick={() => setSearchOpen(true)}
                className="p-2 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] transition-colors flex items-center gap-2 text-xs font-medium border border-[var(--border)] px-3"
                title="Search IPO or Stock (Cmd+K)"
              >
                <Search className="w-4 h-4" />
                <span className="hidden xl:inline">Search (⌘K)</span>
              </button>

              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] transition-colors border border-[var(--border)]"
                title="Toggle Dark/Light theme"
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <Link
                to="/profile"
                className="w-8 h-8 rounded-full bg-[var(--bg-subtle)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                title="User Profile"
              >
                <User className="w-4 h-4" />
              </Link>

              <Link
                to="/chat"
                state={{ forceNewChat: true }}
                className="btn-primary text-sm shadow-sm shrink-0 px-4 py-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Ask Mentor</span>
              </Link>
            </div>

            {/* Mobile Navigation Controls */}
            <div className="flex sm:hidden items-center gap-2 shrink-0">
              <button
                onClick={() => setSearchOpen(true)}
                className="p-2 text-[var(--text-secondary)]"
              >
                <Search className="w-5 h-5" />
              </button>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-[var(--text-secondary)] focus:outline-none"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[var(--border)] bg-[var(--bg-base)] px-4 pt-3 pb-5 space-y-1.5 animate-in slide-in-from-top duration-200">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  state={link.path === '/chat' ? { forceNewChat: true } : undefined}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-base font-medium transition-colors ${
                    active
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${active ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`} />
                  <span>{link.name}</span>
                </Link>
              );
            })}
            <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between px-2">
              <Link
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <User className="w-4 h-4" />
                <span>My Profile</span>
              </Link>
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>
        )}
      </nav>

      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
};

export default Navbar;
