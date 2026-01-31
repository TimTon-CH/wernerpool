import { useState, useEffect } from 'react';
import { 
  Cpu, 
  Activity, 
  CheckCircle, 
  XCircle, 
  Clock,
  Zap,
  RefreshCw
} from 'lucide-react';

interface Worker {
  address: string;
  worker: string;
  hashrate: number;
  hashrateFormatted: string;
  sharesAccepted: number;
  sharesRejected: number;
  bestDifficulty: number;
  lastShare: number;
  connectedAt: number;
}

export default function Workers() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWorkers = async () => {
    try {
      const res = await fetch('/api/clients');
      const data = await res.json();
      setWorkers(data.clients || []);
    } catch (error) {
      console.error('Failed to fetch workers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
    const interval = setInterval(fetchWorkers, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatTimeAgo = (timestamp: number): string => {
    if (!timestamp) return 'Never';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const formatUptime = (connectedAt: number): string => {
    const ms = Date.now() - connectedAt;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Cpu className="w-7 h-7 text-brand-500" />
            Connected Workers
          </h1>
          <p className="text-dark-400 mt-1">
            {workers.length} worker{workers.length !== 1 ? 's' : ''} currently mining
          </p>
        </div>
        <button
          onClick={fetchWorkers}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-dark-800 border border-dark-700 hover:border-brand-500 transition-colors"
        >
          <RefreshCw className="w-4 h-4 text-dark-400" />
          <span className="text-sm text-dark-300">Refresh</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
        </div>
      ) : workers.length === 0 ? (
        <div className="card-gradient rounded-xl p-12 text-center">
          <Cpu className="w-16 h-16 text-dark-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Workers Connected</h3>
          <p className="text-dark-400 mb-6 max-w-md mx-auto">
            Connect your mining hardware to start mining. Use the stratum URL shown on the dashboard.
          </p>
          <div className="bg-dark-800 rounded-lg p-4 inline-block">
            <code className="text-brand-400 font-mono">stratum+tcp://wernerpool.nerds.ch:3333</code>
          </div>
        </div>
      ) : (
        <div className="card-gradient rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left text-dark-400 font-medium px-6 py-4 text-sm">Worker</th>
                  <th className="text-left text-dark-400 font-medium px-6 py-4 text-sm">Address</th>
                  <th className="text-right text-dark-400 font-medium px-6 py-4 text-sm">Hashrate</th>
                  <th className="text-right text-dark-400 font-medium px-6 py-4 text-sm">Accepted</th>
                  <th className="text-right text-dark-400 font-medium px-6 py-4 text-sm">Rejected</th>
                  <th className="text-right text-dark-400 font-medium px-6 py-4 text-sm">Best Diff</th>
                  <th className="text-right text-dark-400 font-medium px-6 py-4 text-sm">Last Share</th>
                  <th className="text-right text-dark-400 font-medium px-6 py-4 text-sm">Uptime</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((worker, index) => (
                  <tr 
                    key={`${worker.address}-${worker.worker}-${index}`}
                    className="border-b border-dark-700/50 hover:bg-dark-800/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
                          <Cpu className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-white font-medium">{worker.worker || 'default'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-dark-300 font-mono text-sm">{worker.address}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Zap className="w-4 h-4 text-yellow-500" />
                        <span className="text-white font-mono">{worker.hashrateFormatted}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-green-400 font-mono">{worker.sharesAccepted}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <XCircle className="w-4 h-4 text-red-500" />
                        <span className="text-red-400 font-mono">{worker.sharesRejected}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-purple-400 font-mono">
                        {worker.bestDifficulty.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Clock className="w-4 h-4 text-dark-500" />
                        <span className="text-dark-300 text-sm">
                          {formatTimeAgo(worker.lastShare)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-dark-300 text-sm">
                        {formatUptime(worker.connectedAt)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
