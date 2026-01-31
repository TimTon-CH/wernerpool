import BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

interface ShareRecord {
  address: string;
  worker: string;
  difficulty: number;
  accepted: boolean;
  timestamp: number;
}

interface BlockRecord {
  address: string;
  worker: string;
  height: number;
  hash: string;
  reward: number;
  timestamp: number;
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
  sharesAccepted: number;
  sharesRejected: number;
  blocksFound: number;
  lastSaved: number;
}

export class Database {
  private db: BetterSqlite3.Database;

  constructor(dataDir: string) {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = path.join(dataDir, 'wernerpool.db');
    this.db = new BetterSqlite3(dbPath);
    
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS shares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        address TEXT NOT NULL,
        worker TEXT NOT NULL,
        difficulty REAL NOT NULL,
        accepted INTEGER NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_shares_address ON shares(address);
      CREATE INDEX IF NOT EXISTS idx_shares_timestamp ON shares(timestamp);

      CREATE TABLE IF NOT EXISTS blocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        address TEXT NOT NULL,
        worker TEXT NOT NULL,
        height INTEGER NOT NULL,
        hash TEXT NOT NULL,
        reward REAL NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS address_stats (
        address TEXT PRIMARY KEY,
        total_hashrate REAL DEFAULT 0,
        worker_count INTEGER DEFAULT 0,
        shares_accepted INTEGER DEFAULT 0,
        shares_rejected INTEGER DEFAULT 0,
        best_difficulty REAL DEFAULT 0,
        last_active INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS best_difficulties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        address TEXT NOT NULL,
        difficulty REAL NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_best_diff ON best_difficulties(difficulty DESC);

      CREATE TABLE IF NOT EXISTS hashrate_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hashrate REAL NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_hashrate_ts ON hashrate_history(timestamp);

      CREATE TABLE IF NOT EXISTS pool_stats (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        shares_accepted INTEGER DEFAULT 0,
        shares_rejected INTEGER DEFAULT 0,
        blocks_found INTEGER DEFAULT 0,
        last_saved INTEGER DEFAULT 0
      );

      INSERT OR IGNORE INTO pool_stats (id) VALUES (1);
    `);
  }

  recordShare(share: ShareRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO shares (address, worker, difficulty, accepted, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(share.address, share.worker, share.difficulty, share.accepted ? 1 : 0, share.timestamp);
  }

  recordBlock(block: BlockRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO blocks (address, worker, height, hash, reward, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(block.address, block.worker, block.height, block.hash, block.reward, block.timestamp);
  }

  saveAddressStats(stats: AddressStats): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO address_stats 
      (address, total_hashrate, worker_count, shares_accepted, shares_rejected, best_difficulty, last_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      stats.address,
      stats.totalHashrate,
      stats.workerCount,
      stats.sharesAccepted,
      stats.sharesRejected,
      stats.bestDifficulty,
      stats.lastActive
    );
  }

  getAddressStats(address: string): AddressStats | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM address_stats WHERE address = ?
    `);
    const row = stmt.get(address) as any;
    if (!row) return undefined;

    return {
      address: row.address,
      totalHashrate: row.total_hashrate,
      workerCount: row.worker_count,
      sharesAccepted: row.shares_accepted,
      sharesRejected: row.shares_rejected,
      bestDifficulty: row.best_difficulty,
      lastActive: row.last_active
    };
  }

  updateBestDifficulty(address: string, difficulty: number): void {
    this.db.prepare(`
      UPDATE address_stats SET best_difficulty = MAX(best_difficulty, ?)
      WHERE address = ?
    `).run(difficulty, address);

    this.db.prepare(`
      INSERT INTO best_difficulties (address, difficulty, timestamp)
      VALUES (?, ?, ?)
    `).run(address, difficulty, Date.now());
  }

  getBestDifficulties(limit: number = 10): { address: string; difficulty: number; timestamp: number }[] {
    const stmt = this.db.prepare(`
      SELECT address, difficulty, timestamp FROM best_difficulties
      ORDER BY difficulty DESC
      LIMIT ?
    `);
    return stmt.all(limit) as any[];
  }

  recordHashrate(record: { timestamp: number; hashrate: number }): void {
    this.db.prepare(`
      INSERT INTO hashrate_history (hashrate, timestamp) VALUES (?, ?)
    `).run(record.hashrate, record.timestamp);

    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    this.db.prepare(`DELETE FROM hashrate_history WHERE timestamp < ?`).run(cutoff);
  }

  getHashrateHistory(minutes: number): { timestamp: number; hashrate: number }[] {
    const cutoff = Date.now() - minutes * 60 * 1000;
    const stmt = this.db.prepare(`
      SELECT hashrate, timestamp FROM hashrate_history
      WHERE timestamp > ?
      ORDER BY timestamp ASC
    `);
    return stmt.all(cutoff) as any[];
  }

  getPoolStats(): PoolStats | null {
    const stmt = this.db.prepare(`SELECT * FROM pool_stats WHERE id = 1`);
    const row = stmt.get() as any;
    if (!row) return null;

    return {
      sharesAccepted: row.shares_accepted,
      sharesRejected: row.shares_rejected,
      blocksFound: row.blocks_found,
      lastSaved: row.last_saved
    };
  }

  savePoolStats(stats: PoolStats): void {
    this.db.prepare(`
      UPDATE pool_stats SET
        shares_accepted = ?,
        shares_rejected = ?,
        blocks_found = ?,
        last_saved = ?
      WHERE id = 1
    `).run(stats.sharesAccepted, stats.sharesRejected, stats.blocksFound, stats.lastSaved);
  }

  getSharesByAddress(address: string, range: string = '1d'): ShareRecord[] {
    const ranges: { [key: string]: number } = {
      '1d': 24 * 60 * 60 * 1000,
      '3d': 3 * 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };
    const cutoff = Date.now() - (ranges[range] || ranges['1d']);

    const stmt = this.db.prepare(`
      SELECT * FROM shares 
      WHERE address = ? AND timestamp > ?
      ORDER BY timestamp DESC
    `);
    return stmt.all(address, cutoff) as any[];
  }

  getBlocks(limit: number = 10): BlockRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM blocks ORDER BY timestamp DESC LIMIT ?
    `);
    return stmt.all(limit) as any[];
  }
}
