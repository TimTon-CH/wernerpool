import { Router, Request, Response } from 'express';
import { PoolState } from '../pool/pool-state';
import { BitcoinRpc } from '../bitcoin/bitcoin-rpc';
import { Database } from '../database/database';
import { Logger } from 'pino';

export class ApiRouter {
  public router: Router;

  constructor(
    private poolState: PoolState,
    private bitcoinRpc: BitcoinRpc,
    private db: Database,
    private logger: Logger
  ) {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Pool info
    this.router.get('/info', this.getInfo.bind(this));
    
    // Network info
    this.router.get('/network', this.getNetwork.bind(this));
    
    // Pool hashrate chart
    this.router.get('/info/chart', this.getHashrateChart.bind(this));
    
    // Pool shares
    this.router.get('/info/shares', this.getPoolShares.bind(this));
    
    // Best difficulties scoreboard
    this.router.get('/info/scoreboard', this.getScoreboard.bind(this));
    
    // Blocks found
    this.router.get('/info/blocks', this.getBlocks.bind(this));
    
    // Client/address info
    this.router.get('/client/:address', this.getClientInfo.bind(this));
    
    // Client hashrate chart
    this.router.get('/client/:address/chart', this.getClientChart.bind(this));
    
    // Client workers
    this.router.get('/client/:address/workers', this.getClientWorkers.bind(this));
    
    // Client shares
    this.router.get('/client/:address/shares', this.getClientShares.bind(this));
    
    // All connected clients
    this.router.get('/clients', this.getAllClients.bind(this));
  }

  private async getInfo(req: Request, res: Response): Promise<void> {
    try {
      const poolStats = this.poolState.getPoolStats();
      let blockHeight = 0;
      let difficulty = 0;
      let blockReward = 3.125;

      try {
        const miningInfo = await this.bitcoinRpc.getMiningInfo();
        blockHeight = miningInfo.blocks;
        difficulty = miningInfo.difficulty;
        
        // Calculate block reward based on halving schedule
        const halvings = Math.floor(blockHeight / 210000);
        blockReward = 50 / Math.pow(2, halvings);
      } catch (error) {
        this.logger.debug({ error }, 'Failed to get mining info');
      }

      res.json({
        poolName: 'WERNERPOOL',
        version: '2.0.0',
        stratumPort: 3333,
        hashrate: poolStats.totalHashrate,
        hashrateFormatted: this.formatHashrate(poolStats.totalHashrate),
        workers: poolStats.totalWorkers,
        addresses: poolStats.totalAddresses,
        sharesAccepted: poolStats.sharesAccepted,
        sharesRejected: poolStats.sharesRejected,
        blocksFound: poolStats.blocksFound,
        uptime: poolStats.uptime,
        uptimeFormatted: this.formatUptime(poolStats.uptime),
        blockHeight,
        difficulty,
        blockReward
      });
    } catch (error) {
      this.logger.error({ error }, 'Failed to get pool info');
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async getNetwork(req: Request, res: Response): Promise<void> {
    try {
      const [blockchainInfo, networkInfo, miningInfo, mempoolInfo] = await Promise.all([
        this.bitcoinRpc.getBlockchainInfo().catch(() => null),
        this.bitcoinRpc.getNetworkInfo().catch(() => null),
        this.bitcoinRpc.getMiningInfo().catch(() => null),
        this.bitcoinRpc.getMempoolInfo().catch(() => null)
      ]);

      // Calculate next difficulty adjustment
      const blocksPerPeriod = 2016;
      const currentBlock = blockchainInfo?.blocks || 0;
      const blocksUntilAdjustment = blocksPerPeriod - (currentBlock % blocksPerPeriod);
      const adjustmentProgress = ((currentBlock % blocksPerPeriod) / blocksPerPeriod) * 100;

      // Calculate estimated time to next adjustment (10 min per block average)
      const estimatedTimeToAdjustment = blocksUntilAdjustment * 10 * 60 * 1000;

      res.json({
        chain: blockchainInfo?.chain || 'main',
        blocks: blockchainInfo?.blocks || 0,
        headers: blockchainInfo?.headers || 0,
        difficulty: miningInfo?.difficulty || 0,
        networkHashrate: miningInfo?.networkhashps || 0,
        networkHashrateFormatted: this.formatHashrate(miningInfo?.networkhashps || 0),
        connections: networkInfo?.connections || 0,
        version: networkInfo?.subversion || '',
        mempoolSize: mempoolInfo?.size || 0,
        mempoolBytes: mempoolInfo?.bytes || 0,
        nextDifficultyAdjustment: {
          blocksRemaining: blocksUntilAdjustment,
          estimatedTime: estimatedTimeToAdjustment,
          progress: adjustmentProgress.toFixed(2)
        }
      });
    } catch (error) {
      this.logger.error({ error }, 'Failed to get network info');
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private getHashrateChart(req: Request, res: Response): void {
    const range = (req.query.range as string) || '1d';
    const ranges: { [key: string]: number } = {
      '1h': 60,
      '6h': 360,
      '1d': 1440,
      '7d': 10080
    };
    
    const minutes = ranges[range] || ranges['1d'];
    const history = this.poolState.getHashrateHistory(minutes);
    
    res.json({
      range,
      data: history.map(h => ({
        timestamp: h.timestamp,
        hashrate: h.hashrate,
        hashrateFormatted: this.formatHashrate(h.hashrate)
      }))
    });
  }

  private getPoolShares(req: Request, res: Response): void {
    const stats = this.poolState.getPoolStats();
    res.json({
      accepted: stats.sharesAccepted,
      rejected: stats.sharesRejected,
      total: stats.sharesAccepted + stats.sharesRejected,
      acceptanceRate: stats.sharesAccepted / Math.max(1, stats.sharesAccepted + stats.sharesRejected) * 100
    });
  }

  private getScoreboard(req: Request, res: Response): void {
    const limit = parseInt(req.query.limit as string) || 10;
    const scoreboard = this.poolState.getBestDifficulties(limit);
    
    res.json({
      scoreboard: scoreboard.map((entry, index) => ({
        rank: index + 1,
        address: this.maskAddress(entry.address),
        difficulty: entry.difficulty,
        difficultyFormatted: this.formatDifficulty(entry.difficulty),
        timestamp: entry.timestamp,
        timeAgo: this.formatTimeAgo(entry.timestamp)
      }))
    });
  }

  private getBlocks(req: Request, res: Response): void {
    const limit = parseInt(req.query.limit as string) || 10;
    const blocks = this.db.getBlocks(limit);
    
    res.json({
      blocks: blocks.map(block => ({
        ...block,
        address: this.maskAddress(block.address),
        timeAgo: this.formatTimeAgo(block.timestamp)
      }))
    });
  }

  private getClientInfo(req: Request, res: Response): void {
    const address = req.params.address as string;
    const stats = this.poolState.getAddressStats(address);
    
    if (!stats) {
      res.status(404).json({ error: 'Address not found' });
      return;
    }

    res.json({
      address,
      hashrate: stats.totalHashrate,
      hashrateFormatted: this.formatHashrate(stats.totalHashrate),
      workers: stats.workerCount,
      sharesAccepted: stats.sharesAccepted,
      sharesRejected: stats.sharesRejected,
      bestDifficulty: stats.bestDifficulty,
      bestDifficultyFormatted: this.formatDifficulty(stats.bestDifficulty),
      lastActive: stats.lastActive,
      lastActiveFormatted: this.formatTimeAgo(stats.lastActive)
    });
  }

  private getClientChart(req: Request, res: Response): void {
    const address = req.params.address as string;
    const range = String(req.query.range || '1d');
    
    // Get shares for the address and calculate hashrate over time
    const shares = this.db.getSharesByAddress(address, range);
    
    // Group by 10-minute intervals and calculate hashrate
    const intervals: Map<number, { shares: number; difficulty: number }> = new Map();
    const intervalSize = 10 * 60 * 1000; // 10 minutes

    shares.forEach(share => {
      const interval = Math.floor(share.timestamp / intervalSize) * intervalSize;
      const existing = intervals.get(interval) || { shares: 0, difficulty: 0 };
      if (share.accepted) {
        existing.shares++;
        existing.difficulty += share.difficulty;
      }
      intervals.set(interval, existing);
    });

    const data = Array.from(intervals.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([timestamp, { shares, difficulty }]) => ({
        timestamp,
        hashrate: (difficulty * 4294967296) / (intervalSize / 1000),
        shares
      }));

    res.json({ range, data });
  }

  private getClientWorkers(req: Request, res: Response): void {
    const address = req.params.address as string;
    const workers = this.poolState.getClientsByAddress(address);
    
    res.json({
      workers: workers.map(w => ({
        name: w.workerName,
        hashrate: w.hashrate,
        hashrateFormatted: this.formatHashrate(w.hashrate),
        sharesAccepted: w.sharesAccepted,
        sharesRejected: w.sharesRejected,
        bestDifficulty: w.bestDifficulty,
        lastShare: w.lastShare,
        lastShareFormatted: this.formatTimeAgo(w.lastShare),
        connectedAt: w.connectedAt,
        uptime: Date.now() - w.connectedAt
      }))
    });
  }

  private getClientShares(req: Request, res: Response): void {
    const address = req.params.address as string;
    const range = String(req.query.range || '1d');
    const shares = this.db.getSharesByAddress(address, range);
    
    const accepted = shares.filter(s => s.accepted).length;
    const rejected = shares.filter(s => !s.accepted).length;

    res.json({
      range,
      accepted,
      rejected,
      total: shares.length,
      acceptanceRate: accepted / Math.max(1, shares.length) * 100
    });
  }

  private getAllClients(req: Request, res: Response): void {
    const clients = this.poolState.getClients();
    
    res.json({
      clients: clients.map(c => ({
        address: this.maskAddress(c.address),
        worker: c.workerName,
        hashrate: c.hashrate,
        hashrateFormatted: this.formatHashrate(c.hashrate),
        sharesAccepted: c.sharesAccepted,
        sharesRejected: c.sharesRejected,
        bestDifficulty: c.bestDifficulty,
        lastShare: c.lastShare,
        connectedAt: c.connectedAt
      }))
    });
  }

  // Helper methods
  private formatHashrate(hashrate: number): string {
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

  private formatDifficulty(difficulty: number): string {
    if (difficulty >= 1e15) return `${(difficulty / 1e15).toFixed(2)}P`;
    if (difficulty >= 1e12) return `${(difficulty / 1e12).toFixed(2)}T`;
    if (difficulty >= 1e9) return `${(difficulty / 1e9).toFixed(2)}G`;
    if (difficulty >= 1e6) return `${(difficulty / 1e6).toFixed(2)}M`;
    if (difficulty >= 1e3) return `${(difficulty / 1e3).toFixed(2)}K`;
    return difficulty.toFixed(2);
  }

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  private formatTimeAgo(timestamp: number): string {
    if (!timestamp) return 'Never';
    
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  private maskAddress(address: string): string {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
}
