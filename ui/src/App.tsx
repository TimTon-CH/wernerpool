import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  BarChart3, 
  Info, 
  Trophy,
  Cpu,
  Wallet,
  TrendingUp,
  Clock,
  Zap,
  Menu,
  Github
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Workers from './pages/Workers';
import Statistics from './pages/Statistics';
import Scoreboard from './pages/Scoreboard';
import InfoPage from './pages/InfoPage';
import MinerLookup from './pages/MinerLookup';

function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const location = useLocation();
  
  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/workers', icon: Cpu, label: 'Workers' },
    { path: '/statistics', icon: BarChart3, label: 'Statistics' },
    { path: '/scoreboard', icon: Trophy, label: 'Scoreboard' },
    { path: '/lookup', icon: Wallet, label: 'Miner Lookup' },
    { path: '/info', icon: Info, label: 'Pool Info' },
  ];

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-dark-900/95 backdrop-blur border-r border-dark-700
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-dark-700">
            <div className="flex items-center gap-3">
              <img 
                src="/logo.png" 
                alt="WERNERPOOL Logo" 
                className="w-12 h-12 rounded-lg"
              />
              <div>
                <h1 className="text-xl font-bold gradient-text">WERNERPOOL</h1>
                <p className="text-xs text-dark-400">Solo Mining Pool</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                    ${isActive 
                      ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' 
                      : 'text-dark-300 hover:bg-dark-800 hover:text-white'
                    }
                  `}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-dark-700 space-y-3">
            <div className="stat-card rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-green-500 pulse-dot" />
                <span className="text-sm text-dark-300">Stratum Online</span>
              </div>
              <p className="text-xs text-dark-400 font-mono">Port 3333</p>
            </div>
            <div className="flex items-center justify-between text-xs text-dark-500">
              <span>v2.0.4</span>
              <a 
                href="https://github.com/TimTon-CH/wernerpool" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-dark-300 transition-colors"
              >
                <Github className="w-3 h-3" />
                GitHub
              </a>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const [networkStats, setNetworkStats] = useState<any>(null);

  useEffect(() => {
    const fetchNetwork = async () => {
      try {
        const res = await fetch('/api/network');
        const data = await res.json();
        setNetworkStats(data);
      } catch (error) {
        console.error('Failed to fetch network stats');
      }
    };
    fetchNetwork();
    const interval = setInterval(fetchNetwork, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-dark-900/80 backdrop-blur border-b border-dark-700 px-4 lg:px-6 py-4">
      <div className="flex items-center justify-between">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-dark-800 text-dark-300"
        >
          <Menu className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-6 ml-auto">
          {networkStats && (
            <>
              <div className="hidden md:flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-brand-500" />
                <span className="text-dark-400">Difficulty:</span>
                <span className="text-white font-mono">
                  {networkStats.difficulty?.toExponential(2) || '—'}
                </span>
              </div>
              <div className="hidden md:flex items-center gap-2 text-sm">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span className="text-dark-400">Network:</span>
                <span className="text-white font-mono">
                  {networkStats.networkHashrateFormatted || '—'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="text-dark-400">Block:</span>
                <span className="text-white font-mono">
                  {networkStats.blocks?.toLocaleString() || '—'}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <BrowserRouter>
      <div className="flex h-screen bg-dark-950">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/workers" element={<Workers />} />
              <Route path="/statistics" element={<Statistics />} />
              <Route path="/scoreboard" element={<Scoreboard />} />
              <Route path="/lookup" element={<MinerLookup />} />
              <Route path="/info" element={<InfoPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
