import express from 'express';
import cors from 'cors';
import { StratumServer } from './stratum/stratum-server';
import { BitcoinRpc } from './bitcoin/bitcoin-rpc';
import { PoolState } from './pool/pool-state';
import { ApiRouter } from './api/api-router';
import { Database } from './database/database';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

const config = {
  stratum: {
    port: parseInt(process.env.STRATUM_PORT || '3333'),
    difficulty: 64,  // Lower difficulty for faster shares
    vardiffTarget: 20,
    vardiffRetargetTime: 120,
    vardiffVariance: 30,
    poolName: process.env.POOL_NAME || 'WERNERPOOL'
  },
  bitcoin: {
    rpcUrl: process.env.BITCOIN_RPC_URL || 'http://127.0.0.1:8332',
    rpcUser: process.env.BITCOIN_RPC_USER || 'bitcoin',
    rpcPass: process.env.BITCOIN_RPC_PASS || 'password',
    rpcHost: process.env.BITCOIN_RPC_HOST || '127.0.0.1',
    rpcPort: parseInt(process.env.BITCOIN_RPC_PORT || '8332'),
    network: process.env.NETWORK || 'mainnet'
  },
  api: {
    port: parseInt(process.env.API_PORT || '3335')
  },
  dataDir: process.env.DATA_DIR || './data'
};

async function main() {
  logger.info('='.repeat(60));
  logger.info('  WERNERPOOL v2 - Solo Bitcoin Mining Pool');
  logger.info('='.repeat(60));
  
  // Initialize database
  const db = new Database(config.dataDir);
  logger.info('Database initialized');

  // Initialize Bitcoin RPC connection
  const bitcoinRpc = new BitcoinRpc(config.bitcoin, logger);
  
  // Test Bitcoin connection
  try {
    const blockchainInfo = await bitcoinRpc.getBlockchainInfo();
    logger.info({ blocks: blockchainInfo.blocks, chain: blockchainInfo.chain }, 'Connected to Bitcoin Core');
  } catch (error) {
    logger.error('Failed to connect to Bitcoin Core. Will retry...');
  }

  // Initialize pool state
  const poolState = new PoolState(db, bitcoinRpc, logger);

  // Initialize stratum server
  const stratumServer = new StratumServer(config.stratum, bitcoinRpc, poolState, logger);
  
  // Start stratum server
  await stratumServer.start();
  logger.info({ port: config.stratum.port }, 'Stratum server started');

  // Initialize API server
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', pool: config.stratum.poolName });
  });

  // Mount API routes
  const apiRouter = new ApiRouter(poolState, bitcoinRpc, db, logger);
  app.use('/api', apiRouter.router);

  // Start API server
  app.listen(config.api.port, '0.0.0.0', () => {
    logger.info({ port: config.api.port }, 'API server started');
    logger.info('');
    logger.info('='.repeat(60));
    logger.info(`  Stratum: stratum+tcp://<your-ip>:${config.stratum.port}`);
    logger.info(`  API:     http://<your-ip>:${config.api.port}`);
    logger.info('='.repeat(60));
  });

  // Handle shutdown
  process.on('SIGTERM', () => {
    logger.info('Shutting down...');
    stratumServer.stop();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('Shutting down...');
    stratumServer.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error(error, 'Fatal error');
  process.exit(1);
});
