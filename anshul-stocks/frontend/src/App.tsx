import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect, createContext, useContext } from 'react';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Chat from './pages/Chat';
import UploadPage from './pages/Upload';
import RecentAnalysis from './pages/RecentAnalysis';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Register from './pages/Register';
import NotFound from './pages/NotFound';
import IPO from './pages/IPO';

export const ThemeContext = createContext({
  darkMode: false,
  toggleDarkMode: () => {},
});

export const useTheme = () => useContext(ThemeContext);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function AppFooter() {
  const location = useLocation();
  if (location.pathname !== '/') return null;
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg-surface)] py-8 text-center text-xs space-y-2 transition-colors duration-200">
      <div className="flex items-center justify-center gap-6 text-[var(--text-secondary)] font-medium">
        <Link to="/" className="hover:text-[var(--text-primary)] transition-colors duration-200">Home</Link>
        <Link to="/chat" state={{ forceNewChat: true }} className="hover:text-[var(--text-primary)] transition-colors duration-200">Ask Mentor</Link>
        <Link to="/ipo" className="hover:text-[var(--text-primary)] transition-colors duration-200">IPO Hub</Link>
        <Link to="/upload" className="hover:text-[var(--text-primary)] transition-colors duration-200">Screenshot Analyzer</Link>
        <Link to="/analysis" className="hover:text-[var(--text-primary)] transition-colors duration-200">History</Link>
      </div>
      <p className="text-[var(--text-muted)] max-w-2xl mx-auto px-4">⚠️ Disclaimer: All content, analysis, ratings and recommendations are for educational and informational purposes only and are NOT financial advice. Investments in the stock market are subject to market risk — invest at your own risk.</p>
      <p className="text-[var(--text-muted)]">&copy; {new Date().getFullYear()} Anshul Stocks AI IPO & Investment Mentor. Built for educational & financial decision support.</p>
    </footer>
  );
}

function App() {
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  }, []);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <div className="flex flex-col min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] font-sans selection:bg-sky-500 selection:text-white transition-colors duration-200">
            <Navbar />
            <main className="flex-1 flex flex-col">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/ipo" element={<IPO />} />
                <Route path="/upload" element={<UploadPage />} />
                <Route path="/analysis" element={<RecentAnalysis />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
            <AppFooter />
          </div>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeContext.Provider>
  );
}

export default App;
