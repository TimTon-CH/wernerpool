import { 
  Info, 
  Hammer, 
  Zap, 
  Shield, 
  Server, 
  Book,
  ExternalLink,
  Copy,
  Check,
  CircleDollarSign
} from 'lucide-react';
import { useState } from 'react';

export default function InfoPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Info className="w-7 h-7 text-brand-500" />
          Pool Information
        </h1>
        <p className="text-dark-400 mt-1">Everything you need to know about WERNERPOOL</p>
      </div>

      <div className="card-gradient rounded-xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center glow-orange">
            <Hammer className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold gradient-text">WERNERPOOL v2</h2>
            <p className="text-dark-400">Solo Bitcoin Mining Pool</p>
          </div>
        </div>

        <div className="prose prose-invert max-w-none">
          <p className="text-dark-300 leading-relaxed">
            WERNERPOOL is a self-hosted solo Bitcoin mining pool running on your Umbrel. 
            With solo mining, you receive the entire block reward (currently 3.125 BTC) 
            when you find a block - no fees, no sharing!
          </p>
        </div>
      </div>

      <div className="card-gradient rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Server className="w-5 h-5 text-brand-500" />
          Connection Settings
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="text-dark-400 text-sm mb-2 block">Stratum URL</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-dark-800 rounded-lg px-4 py-3 text-brand-400 font-mono break-all">
                stratum+tcp://wernerpool.nerds.ch:3333
              </code>
              <button
                onClick={() => copyToClipboard('stratum+tcp://wernerpool.nerds.ch:3333', 'stratum')}
                className="p-3 rounded-lg bg-dark-800 hover:bg-dark-700 transition-colors"
              >
                {copied === 'stratum' ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : (
                  <Copy className="w-5 h-5 text-dark-400" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="text-dark-400 text-sm mb-2 block">Username Format</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-dark-800 rounded-lg px-4 py-3 text-green-400 font-mono break-all">
                YOUR_BTC_ADDRESS.WORKER_NAME
              </code>
              <button
                onClick={() => copyToClipboard('YOUR_BTC_ADDRESS.WORKER_NAME', 'username')}
                className="p-3 rounded-lg bg-dark-800 hover:bg-dark-700 transition-colors"
              >
                {copied === 'username' ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : (
                  <Copy className="w-5 h-5 text-dark-400" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="text-dark-400 text-sm mb-2 block">Password</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-dark-800 rounded-lg px-4 py-3 text-yellow-400 font-mono">
                x (or anything)
              </code>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card-gradient rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            Features
          </h3>
          <ul className="space-y-3 text-dark-300">
            <li className="flex items-start gap-3">
              <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Full Stratum V1 protocol support</span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Real-time hashrate monitoring</span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Worker management & statistics</span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Best difficulty scoreboard</span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Network difficulty tracking</span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Persistent statistics storage</span>
            </li>
          </ul>
        </div>

        <div className="card-gradient rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-500" />
            Benefits of Solo Mining
          </h3>
          <ul className="space-y-3 text-dark-300">
            <li className="flex items-start gap-3">
              <CircleDollarSign className="w-5 h-5 text-brand-500 mt-0.5 flex-shrink-0" />
              <span>Full block reward goes to you</span>
            </li>
            <li className="flex items-start gap-3">
              <CircleDollarSign className="w-5 h-5 text-brand-500 mt-0.5 flex-shrink-0" />
              <span>No pool fees or hidden costs</span>
            </li>
            <li className="flex items-start gap-3">
              <CircleDollarSign className="w-5 h-5 text-brand-500 mt-0.5 flex-shrink-0" />
              <span>Complete privacy - your address only</span>
            </li>
            <li className="flex items-start gap-3">
              <CircleDollarSign className="w-5 h-5 text-brand-500 mt-0.5 flex-shrink-0" />
              <span>Support Bitcoin decentralization</span>
            </li>
            <li className="flex items-start gap-3">
              <CircleDollarSign className="w-5 h-5 text-brand-500 mt-0.5 flex-shrink-0" />
              <span>Use your own Bitcoin node</span>
            </li>
            <li className="flex items-start gap-3">
              <CircleDollarSign className="w-5 h-5 text-brand-500 mt-0.5 flex-shrink-0" />
              <span>Fun to mine - lottery style!</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="card-gradient rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Book className="w-5 h-5 text-brand-500" />
          Mining Theory
        </h3>
        <div className="space-y-4 text-dark-300">
          <p>
            Solo mining is like playing the lottery with your hashpower. Every hash you 
            compute has a small chance of finding a valid block. The more hashpower you 
            have, the better your odds.
          </p>
          <p>
            When you find a block, the entire reward (currently 3.125 BTC + transaction fees) 
            goes directly to your Bitcoin address. There's no pool to take fees or share 
            rewards with other miners.
          </p>
          <p>
            The expected time to find a block depends on your hashrate relative to the 
            total network hashrate. With small hashpower, it may take years to find a block, 
            but when you do, it's all yours!
          </p>
          <div className="bg-dark-800 rounded-lg p-4 mt-4">
            <p className="text-brand-400 font-medium mb-2">Block Probability Formula:</p>
            <code className="text-sm text-dark-300">
              P(block) = Your Hashrate / Network Hashrate
            </code>
          </div>
        </div>
      </div>

      <div className="card-gradient rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Credits & Links</h3>
        <div className="space-y-3">
          <a 
            href="https://github.com/benjamin-wilson/public-pool"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-brand-400 hover:text-brand-300 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Based on Public Pool by Benjamin Wilson
          </a>
          <p className="text-dark-400 text-sm">
            WERNERPOOL v2 is a fork of the public-pool project, customized for 
            Umbrel and enhanced with additional features.
          </p>
        </div>
      </div>
    </div>
  );
}
