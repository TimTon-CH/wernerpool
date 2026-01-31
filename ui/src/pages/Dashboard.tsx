import { useState, useEffect } from 'react';
import { 
  Activity, 
  Users, 
  Zap, 
  Award, 
  TrendingUp, 
  CheckCircle,
  Hammer,
  CircleDollarSign
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

interface PoolInfo {
  poolName: string;
  version: string;
  hashrate: number;
  hashrateFormatted: string;
  workers: number;
  addresses: number;
  sharesAccepted: number;
  sharesRejected: number;
  blocksFound: number;
  uptime: number;
  uptimeFormatted: string;
  blockHeight: number;
  difficulty: number;
  blockReward: number;
  averageHashrates?: {
    '10min': string;
    '30min': string;
    '1hr': string;
    '4hr': string;
    '12hr': string;
    '1d': string;
  };
}

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  subValue,
  color = 'brand'
}: { 
  icon: any; 
  label: string; 
  value: string | number; 
  subValue?: string;
  color?: string;
}) {
  const colorClasses: { [key: string]: string } = {
    brand: 'from-brand-500 to-brand-600',
    green: 'from-green-500 to-green-600',
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
    yellow: 'from-yellow-500 to-yellow-600',
  };

  return (
    <div className="stat-card rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-dark-400 text-sm mb-1">{label}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          {subValue && (
            <p className="text-xs text-dark-400 mt-1">{subValue}</p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
}

function HashrateChart({ data }: { data: any[] }) {
  return (
    <div className="card-gradient rounded-xl p-5">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Activity className="w-5 h-5 text-brand-500" />
        Pool Hashrate (24h)
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="hashrate" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="time" 
              stroke="#6b7280"
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              stroke="#6b7280"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => formatHashrate(value)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#9ca3af' }}
              formatter={(value: number) => [formatHashrate(value), 'Hashrate']}
            />
            <Area
              type="monotone"
              dataKey="hashrate"
              stroke="#f97316"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#hashrate)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function formatHashrate(hashrate: number): string {
  if (hashrate === 0) return '0 H/s';
  const units = ['H/s', 'KH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s', 'EH/s'];
  let unitIndex = 0;
  let value = hashrate;
  while (value >= 1000 && unitIndex < units.length - 1) {
    value /= 1000;
    unitIndex++;
  }
  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

export default function Dashboard() {
  const [poolInfo, setPoolInfo] = useState<PoolInfo | null>(null);
  const [hashrateData, setHashrateData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [infoRes, chartRes] = await Promise.all([
          fetch('/api/info'),
          fetch('/api/info/chart?range=1d')
        ]);
        
        const info = await infoRes.json();
        const chart = await chartRes.json();

        setPoolInfo(info);
        
        if (chart.data) {
          setHashrateData(chart.data.map((d: any) => ({
            time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            hashrate: d.hashrate
          })));
        }
      } catch (error) {
        console.error('Failed to fetch pool data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    );
  }

  const acceptanceRate = poolInfo 
    ? (poolInfo.sharesAccepted / Math.max(1, poolInfo.sharesAccepted + poolInfo.sharesRejected) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Hammer className="w-7 h-7 text-brand-500" />
            WERNERPOOL Dashboard
          </h1>
          <p className="text-dark-400 mt-1">Solo Bitcoin Mining Pool</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg bg-dark-800 border border-dark-700">
          <div className="w-2 h-2 rounded-full bg-green-500 pulse-dot" />
          <span className="text-sm text-dark-300">
            Uptime: {poolInfo?.uptimeFormatted || '—'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Zap}
          label="Pool Hashrate"
          value={poolInfo?.hashrateFormatted || '0 H/s'}
          subValue="Total computing power"
          color="brand"
        />
        <StatCard
          icon={Users}
          label="Active Workers"
          value={poolInfo?.workers || 0}
          subValue={`${poolInfo?.addresses || 0} unique addresses`}
          color="blue"
        />
        <StatCard
          icon={CheckCircle}
          label="Shares Accepted"
          value={poolInfo?.sharesAccepted?.toLocaleString() || 0}
          subValue={`${acceptanceRate}% acceptance rate`}
          color="green"
        />
        <StatCard
          icon={Award}
          label="Blocks Found"
          value={poolInfo?.blocksFound || 0}
          subValue={`${poolInfo?.blockReward?.toFixed(4) || '3.125'} BTC reward`}
          color="yellow"
        />
      </div>

      <div className="card-gradient rounded-xl p-5">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-brand-500" />
          Average Pool Hashrate
        </h3>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { label: '10Min', value: poolInfo?.averageHashrates?.['10min'] || poolInfo?.hashrateFormatted || '0 H/s' },
            { label: '30Min', value: poolInfo?.averageHashrates?.['30min'] || poolInfo?.hashrateFormatted || '0 H/s' },
            { label: '1HR', value: poolInfo?.averageHashrates?.['1hr'] || poolInfo?.hashrateFormatted || '0 H/s' },
            { label: '4HR', value: poolInfo?.averageHashrates?.['4hr'] || poolInfo?.hashrateFormatted || '0 H/s' },
            { label: '12HR', value: poolInfo?.averageHashrates?.['12hr'] || poolInfo?.hashrateFormatted || '0 H/s' },
            { label: '1D', value: poolInfo?.averageHashrates?.['1d'] || poolInfo?.hashrateFormatted || '0 H/s' },
          ].map((item) => (
            <div key={item.label} className="stat-card rounded-lg p-3 text-center">
              <p className="text-dark-400 text-xs mb-1">{item.label}</p>
              <p className="text-white font-mono text-sm font-medium">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <HashrateChart data={hashrateData} />
        </div>

        <div className="space-y-4">
          <div className="card-gradient rounded-xl p-5">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-brand-500" />
              Network Stats
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-dark-700">
                <span className="text-dark-400">Block Height</span>
                <span className="text-white font-mono">
                  {poolInfo?.blockHeight?.toLocaleString() || '—'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-dark-700">
                <span className="text-dark-400">Difficulty</span>
                <span className="text-white font-mono text-sm">
                  {poolInfo?.difficulty?.toExponential(2) || '—'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-dark-700">
                <span className="text-dark-400">Block Reward</span>
                <span className="text-white font-mono">
                  {poolInfo?.blockReward?.toFixed(4) || '3.125'} BTC
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-dark-400">Rejected Shares</span>
                <span className="text-red-400 font-mono">
                  {poolInfo?.sharesRejected?.toLocaleString() || 0}
                </span>
              </div>
            </div>
          </div>

          <div className="card-gradient rounded-xl p-5">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <CircleDollarSign className="w-5 h-5 text-yellow-500" />
              Connection Info
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-dark-400 text-sm mb-1">Stratum URL</p>
                <code className="block bg-dark-800 rounded-lg px-3 py-2 text-sm font-mono text-brand-400 break-all">
                  stratum+tcp://YOUR_IP:3333
                </code>
              </div>
              <div>
                <p className="text-dark-400 text-sm mb-1">Worker Format</p>
                <code className="block bg-dark-800 rounded-lg px-3 py-2 text-sm font-mono text-green-400 break-all">
                  YOUR_BTC_ADDRESS.WORKER_NAME
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
