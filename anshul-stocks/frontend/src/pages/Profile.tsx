import React from 'react';
import { User, Shield, Sparkles, Key, MessageSquare, History, HardDrive } from 'lucide-react';

const Profile: React.FC = () => {
  const user = {
    fullName: 'Anshul Sidana',
    email: 'anshul@example.com',
    plan: 'AI Investment Mentor Pro',
    conversationsCount: 14,
    screenshotsAnalyzed: 8,
    joinedDate: 'July 2026',
  };

  return (
    <div className="flex-1 bg-[var(--bg-base)] text-white p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full animate-in fade-in duration-300">
      <div className="space-y-2 mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] flex items-center gap-2.5">
          <User className="w-6 h-6 text-[var(--accent)]" />
          <span>User Profile</span>
        </h1>
        <p className="text-[var(--text-secondary)] text-xs sm:text-sm">
          Manage your account credentials and view your AI usage stats.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* User Card */}
        <div className="md:col-span-1 premium-card p-6 flex flex-col items-center text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#2563EB] to-sky-500 p-1 shadow-lg">
            <div className="w-full h-full bg-[var(--bg-surface)] rounded-full flex items-center justify-center">
              <User className="w-9 h-9 text-[var(--accent)]" />
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">{user.fullName}</h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{user.email}</p>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent)] text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{user.plan}</span>
          </div>

          <div className="w-full pt-4 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
            Member since {user.joinedDate}
          </div>
        </div>

        {/* Activity & Stats */}
        <div className="md:col-span-2 space-y-6">
          <div className="premium-card p-6 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
              <Shield className="w-4 h-4 text-[var(--accent)]" />
              <span>AI Mentor Activity Overview</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-center">
                <MessageSquare className="w-5 h-5 text-[var(--accent)] mx-auto mb-2" />
                <div className="text-2xl font-bold text-[var(--text-primary)]">{user.conversationsCount}</div>
                <div className="text-[11px] text-[var(--text-secondary)] mt-1">AI Conversations</div>
              </div>

              <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-center">
                <HardDrive className="w-5 h-5 text-[var(--accent)] mx-auto mb-2" />
                <div className="text-2xl font-bold text-[var(--text-primary)]">{user.screenshotsAnalyzed}</div>
                <div className="text-[11px] text-[var(--text-secondary)] mt-1">Screenshots Processed</div>
              </div>

              <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-center">
                <History className="w-5 h-5 text-[var(--success)] mx-auto mb-2" />
                <div className="text-2xl font-bold text-[var(--text-primary)]">100%</div>
                <div className="text-[11px] text-[var(--text-secondary)] mt-1">Live Exchange AI Ready</div>
              </div>
            </div>
          </div>

          <div className="premium-card p-6 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
              <Key className="w-4 h-4 text-[var(--accent)]" />
              <span>Security & Password</span>
            </h3>

            <div className="space-y-3">
              <button
                type="button"
                className="w-full py-2.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] text-[var(--text-primary)] font-semibold text-xs transition-all border border-[var(--border)]"
              >
                Change Password
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
