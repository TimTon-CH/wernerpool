import { Logger } from 'pino';
import { Database } from '../database/database';
import { BitcoinRpc } from '../bitcoin/bitcoin-rpc';

interface ClientInfo {
  id: string;
  address: string;
  workerName: string;
  difficulty: number;
  hashrate: number;
  sharesAccepted: number;
  sharesRejected: number;
  bestDifficulty: number;
  lastShare: number;
  connectedAt: number;
}

interface AddressStats {
  address: string;
  totalHashrate: number;
  workerCount: number;
  sharesAccepted: number;
  sharesRejected: number;
  bestDifficulty: number;
  lastActive: number;
}

interface PoolStats {
  totalHashrate: number;
  totalWorkers: number;
  totalAddresses: number;
  sharesAccepted: number;
  sharesRejected: number;
  blocksFound: number;
  uptime: number;
}

export class PoolState {
  private clients: Map<string, ClientInfo> = new Map();
  private addressStats: Map<string, AddressStats> = new Map();
  private startTime: number = Date.now();
  private totalSharesAccepted = 0;
  private totalSharesRejected = 0;
  private blocksFound = 0;
  private hashrateHistory: { timestamp: number; hashrate: number }[] = [];

  constructor(
    private db: Database,
    private bitcoinRpc: BitcoinRpc,
    private logger: Logger
  ) {
    // Load persisted stats
    this.loadStats();
    
    // Record hashrate periodically
    setInterval(() => this.recordHashrate(), 60000);
    
    // Save stats periodically
    setInterval(() => this.saveStats(), 300000);
  }

  private loadStats(): void {
    try {
      const stats = this.db.getPoolStats();
      if (stats) {
        this.totalSharesAccepted = stats.sharesAccepted || 0;
        this.totalSharesRejected = stats.sharesRejected || 0;
        this.blocksFound = stats.blocksFound || 0;
      }
      this.hashrateHistory = this.db.getHashrateHistory(24 * 60);
    } catch (error) {
      this.logger.debug({ error }, 'Failed to load stats');
    }
  }

  private saveStats(): void {
    try {
      this.db.savePoolStats({
        sharesAccepted: this.totalSharesAccepted,
        sharesRejected: this.totalSharesRejected,
        blocksFound: this.blocksFound,
        lastSaved: Date.now()
      });
    } catch (error) {
      this.logger.debug({ error }, 'Failed to save stats');
    }
  }

  addClient(client: any): void {
    this.clients.set(client.id, {
      id: client.id,
      address: client.address,
      workerName: client.workerName,
      difficulty: client.difficulty,
      hashrate: 0,
      sharesAccepted: 0,
      sharesRejected: 0,
      bestDifficulty: 0,
      lastShare: 0,
      connectedAt: client.connectedAt
    });
  }

  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client && client.address) {
      this.updateAddressStats(client.address);
    }
    this.clients.delete(clientId);
  }

  updateClient(client: any): void {
    const existing = this.clients.get(client.id);
    if (existing) {
      this.clients.set(client.id, {
        ...existing,
        address: client.address,
        workerName: client.workerName,
        hashrate: client.hashrate,
        sharesAccepted: client.sharesAccepted,
        sharesRejected: client.sharesRejected,
        bestDifficulty: client.bestDifficulty,
        lastShare: client.lastShare
      });
      
      if (client.address) {
        this.updateAddressStats(client.address);
      }
    }
  }

  private updateAddressStats(address: string): void {
    const workers = Array.from(this.clients.values()).filter(c => c.address === address);
    
    const stats: AddressStats = {
      address,
      totalHashrate: workers.reduce((sum, w) => sum + w.hashrate, 0),
      workerCount: workers.length,
      sharesAccepted: workers.reduce((sum, w) => sum + w.sharesAccepted, 0),
      sharesRejected: workers.reduce((sum, w) => sum + w.sharesRejected, 0),
      bestDifficulty: Math.max(...workers.map(w => w.bestDifficulty), 0),
      lastActive: Math.max(...workers.map(w => w.lastShare), 0)
    };

    this.addressStats.set(address, stats);
    this.db.saveAddressStats(stats);
  }

  recordShare(client: any, difficulty: number, accepted: boolean): void {
    if (accepted) {
      this.totalSharesAccepted++;
    } else {
      this.totalSharesRejected++;
    }

    this.db.recordShare({
      address: client.address,
      worker: client.workerName,
      difficulty,
      accepted,
      timestamp: Date.now()
    });
  }

  updateBestDifficulty(address: string, difficulty: number): void {
    this.db.updateBestDifficulty(address, difficulty);
    this.logger.info({ address, difficulty: difficulty.toFixed(4) }, 'New best difficulty');
  }

  recordBlockFound(address: string, worker: string): void {
    this.blocksFound++;
    this.db.recordBlock({
      address,
      worker,
      height: 0,
      hash: '',
      reward: 0,
      timestamp: Date.now()
    });
    this.saveStats();
  }

  private recordHashrate(): void {
    const totalHashrate = this.getTotalHashrate();
    const record = { timestamp: Date.now(), hashrate: totalHashrate };
    this.hashrateHistory.push(record);
    
    // Keep last 24 hours
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.hashrateHistory = this.hashrateHistory.filter(r => r.timestamp > oneDayAgo);
    
    this.db.recordHashrate(record);
  }

  getTotalHashrate(): number {
    return Array.from(this.clients.values()).reduce((sum, c) => sum + c.hashrate, 0);
  }

  getPoolStats(): PoolStats {
    const addresses = new Set(Array.from(this.clients.values()).map(c => c.address).filter(a => a));
    
    return {
      totalHashrate: this.getTotalHashrate(),
      totalWorkers: this.clients.size,
      totalAddresses: addresses.size,
      sharesAccepted: this.totalSharesAccepted,
      sharesRejected: this.totalSharesRejected,
      blocksFound: this.blocksFound,
      uptime: Date.now() - this.startTime
    };
  }

  getClients(): ClientInfo[] {
    return Array.from(this.clients.values());
  }

  getClientsByAddress(address: string): ClientInfo[] {
    return Array.from(this.clients.values()).filter(c => c.address === address);
  }

  getAddressStats(address: string): AddressStats | undefined {
    // First try live data
    const workers = this.getClientsByAddress(address);
    if (workers.length > 0) {
      return {
        address,
        totalHashrate: workers.reduce((sum, w) => sum + w.hashrate, 0),
        workerCount: workers.length,
        sharesAccepted: workers.reduce((sum, w) => sum + w.sharesAccepted, 0),
        sharesRejected: workers.reduce((sum, w) => sum + w.sharesRejected, 0),
        bestDifficulty: Math.max(...workers.map(w => w.bestDifficulty), 0),
        lastActive: Math.max(...workers.map(w => w.lastShare), 0)
      };
    }
    
    // Fall back to persisted data
    return this.db.getAddressStats(address);
  }

  getHashrateHistory(minutes: number = 60): { timestamp: number; hashrate: number }[] {
    const cutoff = Date.now() - minutes * 60 * 1000;
    return this.hashrateHistory.filter(r => r.timestamp > cutoff);
  }

  getBestDifficulties(limit: number = 10): { address: string; difficulty: number; timestamp: number }[] {
    return this.db.getBestDifficulties(limit);
  }
}
