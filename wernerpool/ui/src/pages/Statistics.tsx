import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Activity,
  PieChart,
  Clock,
  Zap,
  Target
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RePieChart,
  Pie,
  Cell
} from 'recharts';

interface NetworkInfo {
  blocks: number;
  difficulty: number;
  networkHashrate: number;
  networkHashrateFormatted: string;
  nextDifficultyAdjustment: {
    blocksRemaining: number;
    estimatedTime: number;
    progress: string;
  };
}

interface PoolStats {
  accepted: number;
  rejected: number;
  total: number;
  acceptanceRate: number;
}

export default function Statistics() {
  const [network, setNetwork] = useState<NetworkInfo | null>(null);
  const [poolStats, setPoolStats] = useState<PoolStats | null>(null);
  const [hashrateData, setHashrateData] = useState<any[]>([]);
  const [range, setRange] = useState('1d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [networkRes, statsRes, chartRes] = await Promise.all([
          fetch('/api/network'),
          fetch('/api/info/shares'),
          fetch(`/api/info/chart?range=${range}`)
        ]);

        const networkData = await networkRes.json();
        const statsData = await statsRes.json();
        const chartData = await chartRes.json();

        setNetwork(networkData);
        setPoolStats(statsData);
        
        if (chartData.data) {
          setHashrateData(chartData.data.map((d: any) => ({
            time: new Date(d.timestamp).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            }),
            hashrate: d.hashrate
          })));
        }
      } catch (error) {
        console.error('Failed to fetch statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [range]);

  const formatTime = (ms: number): string => {
    const hours = Math.floor(ms / 3600000);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h`;
    return `${hours}h`;
  };

  const sharesPieData = poolStats ? [
    { name: 'Accepted', value: poolStats.accepted, color: '#22c55e' },
    { name: 'Rejected', value: poolStats.rejected, color: '#ef4444' }
  ] : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-brand-500" />
            Pool Statistics
          </h1>
          <p className="text-dark-400 mt-1">Mining performance and network analysis</p>
        </div>
        <div className="flex items-center gap-2">
          {['1h', '6h', '1d', '7d'].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                range === r
                  ? 'bg-brand-500 text-white'
                  : 'bg-dark-800 text-dark-300 hover:text-white'
              }`}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-gradient rounded-xl p-5">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-brand-500" />
            Hashrate History
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hashrateData}>
                <defs>
                  <linearGradient id="hashGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#6b7280" tick={{ fontSize: 11 }} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="hashrate"
                  stroke="#f97316"
                  strokeWidth={2}
                  fill="url(#hashGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-gradient rounded-xl p-5">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-brand-500" />
            Share Distribution
          </h3>
          <div className="h-64 flex items-center justify-center">
            {poolStats && poolStats.total > 0 ? (
              <div className="flex items-center gap-8">
                <ResponsiveContainer width={180} height={180}>
                  <RePieChart>
                    <Pie
                      data={sharesPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                    >
                      {sharesPieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                  </RePieChart>
                </ResponsiveContainer>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded bg-green-500" />
                    <div>
                      <p className="text-white font-medium">
                        {poolStats.accepted.toLocaleString()}
                      </p>
                      <p className="text-dark-400 text-sm">Accepted</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded bg-red-500" />
                    <div>
                      <p className="text-white font-medium">
                        {poolStats.rejected.toLocaleString()}
                      </p>
                      <p className="text-dark-400 text-sm">Rejected</p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-dark-700">
                    <p className="text-brand-400 font-bold text-xl">
                      {poolStats.acceptanceRate.toFixed(1)}%
                    </p>
                    <p className="text-dark-400 text-sm">Acceptance Rate</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-dark-400">No shares recorded yet</p>
            )}
          </div>
        </div>
      </div>

      <div className="card-gradient rounded-xl p-5">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-brand-500" />
          Next Difficulty Adjustment
        </h3>
        
        {network?.nextDifficultyAdjustment && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-dark-400">Progress</span>
              <span className="text-white font-mono">
                {network.nextDifficultyAdjustment.progress}%
              </span>
            </div>
            <div className="w-full bg-dark-800 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-brand-500 to-brand-400 h-3 rounded-full transition-all duration-500"
                style={{ width: `${network.nextDifficultyAdjustment.progress}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="stat-card rounded-lg p-4">
                <p className="text-dark-400 text-sm">Blocks Remaining</p>
                <p className="text-white text-2xl font-bold font-mono">
                  {network.nextDifficultyAdjustment.blocksRemaining.toLocaleString()}
                </p>
              </div>
              <div className="stat-card rounded-lg p-4">
                <p className="text-dark-400 text-sm">Estimated Time</p>
                <p className="text-white text-2xl font-bold font-mono">
                  {formatTime(network.nextDifficultyAdjustment.estimatedTime)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-brand-500" />
            <span className="text-dark-400">Current Difficulty</span>
          </div>
          <p className="text-2xl font-bold text-white font-mono">
            {network?.difficulty?.toExponential(2) || '—'}
          </p>
        </div>
        <div className="stat-card rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            <span className="text-dark-400">Network Hashrate</span>
          </div>
          <p className="text-2xl font-bold text-white font-mono">
            {network?.networkHashrateFormatted || '—'}
          </p>
        </div>
        <div className="stat-card rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-blue-500" />
            <span className="text-dark-400">Block Height</span>
          </div>
          <p className="text-2xl font-bold text-white font-mono">
            {network?.blocks?.toLocaleString() || '—'}
          </p>
        </div>
      </div>
    </div>
  );
}
