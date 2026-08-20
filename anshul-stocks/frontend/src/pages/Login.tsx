import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, Mail, Lock, LogIn } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigate('/');
    }, 800);
  };

  return (
    <div className="flex-1 flex justify-center items-center py-16 px-4 bg-[var(--bg-base)] animate-in fade-in duration-300">
      <div className="max-w-md w-full premium-card p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-2xl flex items-center justify-center text-[var(--accent)] mx-auto shadow-sm">
            <Sparkles size={24} />
          </div>
          <h2 className="text-2xl font-extrabold text-[var(--text-primary)]">Welcome Back</h2>
          <p className="text-[var(--text-secondary)] text-xs">Sign in to your AI Investment Mentor Workspace</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-gray-300 text-xs font-semibold uppercase tracking-wider mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-[#0B1220] border border-[#1F2937] rounded-xl py-2.5 pl-10 pr-4 text-white caret-sky-400 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30 transition-all text-sm placeholder:text-gray-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-300 text-xs font-semibold uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#0B1220] border border-[#1F2937] rounded-xl py-2.5 pl-10 pr-4 text-white caret-sky-400 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30 transition-all text-sm placeholder:text-gray-400"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <LogIn size={18} />
            {loading ? 'Signing in...' : 'Sign In to Workspace'}
          </button>
        </form>

        <div className="pt-4 border-t border-[var(--border)] text-center text-xs text-[var(--text-secondary)]">
          Don't have an account?{' '}
          <Link to="/register" className="text-[var(--accent)] font-semibold hover:underline">
            Register Account
          </Link>
        </div>
      </div>
    </div>
  );
}

