import { useState } from 'react';
import { 
  Search, 
  Wallet, 
  Zap, 
  Users, 
  CheckCircle, 
  XCircle,
  Trophy,
  Clock,
  Activity
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

interface MinerStats {
  address: string;
  hashrate: number;
  hashrateFormatted: string;
  workers: number;
  sharesAccepted: number;
  sharesRejected: number;
  bestDifficulty: number;
  bestDifficultyFormatted: string;
  lastActive: number;
  lastActiveFormatted: string;
}

interface Worker {
  name: string;
  hashrate: number;
  hashrateFormatted: string;
  sharesAccepted: number;
  sharesRejected: number;
  bestDifficulty: number;
  lastShare: number;
  lastShareFormatted: string;
  uptime: number;
}

export default function MinerLookup() {
  const [address, setAddress] = useState('');
  const [minerStats, setMinerStats] = useState<MinerStats | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;

    setLoading(true);
    setError('');
    setSearched(true);

    try {
      const [statsRes, workersRes, chartRes] = await Promise.all([
        fetch(`/api/client/${address}`),
        fetch(`/api/client/${address}/workers`),
        fetch(`/api/client/${address}/chart?range=1d`)
      ]);

      if (!statsRes.ok) {
        throw new Error('Address not found');
      }

      const stats = await statsRes.json();
      const workersData = await workersRes.json();
      const chart = await chartRes.json();

      setMinerStats(stats);
      setWorkers(workersData.workers || []);
      
      if (chart.data) {
        setChartData(chart.data.map((d: any) => ({
          time: new Date(d.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          hashrate: d.hashrate
        })));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch miner data');
      setMinerStats(null);
      setWorkers([]);
      setChartData([]);
    } finally {
      setLoading(false);
    }
  };

  const formatUptime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Wallet className="w-7 h-7 text-brand-500" />
          Miner Lookup
        </h1>
        <p className="text-dark-400 mt-1">
          Search for a Bitcoin address to view mining statistics
        </p>
      </div>

      <form onSubmit={handleSearch} className="card-gradient rounded-xl p-5">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-dark-400" />
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter Bitcoin address..."
              className="w-full bg-dark-800 border border-dark-600 rounded-lg pl-12 pr-4 py-3 text-white placeholder-dark-400 focus:outline-none focus:border-brand-500 font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {error && searched && (
        <div className="card-gradient rounded-xl p-8 text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-white font-medium">{error}</p>
          <p className="text-dark-400 text-sm mt-1">
            This address may not have any mining activity yet
          </p>
        </div>
      )}

      {minerStats && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="stat-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                <span className="text-dark-400 text-sm">Hashrate</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {minerStats.hashrateFormatted}
              </p>
            </div>
            <div className="stat-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-blue-500" />
                <span className="text-dark-400 text-sm">Workers</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {minerStats.workers}
              </p>
            </div>
            <div className="stat-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-dark-400 text-sm">Accepted</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {minerStats.sharesAccepted.toLocaleString()}
              </p>
            </div>
            <div className="stat-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-5 h-5 text-purple-500" />
                <span className="text-dark-400 text-sm">Best Difficulty</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {minerStats.bestDifficultyFormatted}
              </p>
            </div>
          </div>

          {chartData.length > 0 && (
            <div className="card-gradient rounded-xl p-5">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-brand-500" />
                Hashrate History (24h)
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="minerHash" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
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
                      fill="url(#minerHash)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {workers.length > 0 && (
            <div className="card-gradient rounded-xl overflow-hidden">
              <div className="p-5 border-b border-dark-700">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-brand-500" />
                  Workers ({workers.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-dark-700">
                      <th className="text-left text-dark-400 font-medium px-6 py-3 text-sm">Name</th>
                      <th className="text-right text-dark-400 font-medium px-6 py-3 text-sm">Hashrate</th>
                      <th className="text-right text-dark-400 font-medium px-6 py-3 text-sm">Accepted</th>
                      <th className="text-right text-dark-400 font-medium px-6 py-3 text-sm">Rejected</th>
                      <th className="text-right text-dark-400 font-medium px-6 py-3 text-sm">Last Share</th>
                      <th className="text-right text-dark-400 font-medium px-6 py-3 text-sm">Uptime</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workers.map((worker, index) => (
                      <tr key={index} className="border-b border-dark-700/50">
                        <td className="px-6 py-3 text-white font-medium">{worker.name}</td>
                        <td className="px-6 py-3 text-right font-mono text-white">
                          {worker.hashrateFormatted}
                        </td>
                        <td className="px-6 py-3 text-right font-mono text-green-400">
                          {worker.sharesAccepted}
                        </td>
                        <td className="px-6 py-3 text-right font-mono text-red-400">
                          {worker.sharesRejected}
                        </td>
                        <td className="px-6 py-3 text-right text-dark-300 text-sm">
                          {worker.lastShareFormatted}
                        </td>
                        <td className="px-6 py-3 text-right text-dark-300 text-sm">
                          {formatUptime(worker.uptime)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
