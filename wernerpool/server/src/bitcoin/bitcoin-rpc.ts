import { Logger } from 'pino';

interface BitcoinConfig {
  rpcUrl: string;
  rpcUser: string;
  rpcPass: string;
  rpcHost: string;
  rpcPort: number;
  network: string;
}

interface BlockchainInfo {
  chain: string;
  blocks: number;
  headers: number;
  bestblockhash: string;
  difficulty: number;
  mediantime: number;
  verificationprogress: number;
  initialblockdownload: boolean;
  chainwork: string;
  size_on_disk: number;
  pruned: boolean;
}

interface NetworkInfo {
  version: number;
  subversion: string;
  protocolversion: number;
  connections: number;
  networks: any[];
  relayfee: number;
  localrelay: boolean;
  timeoffset: number;
  networkactive: boolean;
}

interface MiningInfo {
  blocks: number;
  difficulty: number;
  networkhashps: number;
  pooledtx: number;
  chain: string;
}

interface BlockTemplate {
  version: number;
  rules: string[];
  previousblockhash: string;
  transactions: any[];
  coinbaseaux: { [key: string]: string };
  coinbasevalue: number;
  longpollid: string;
  target: string;
  mintime: number;
  mutable: string[];
  noncerange: string;
  sigoplimit: number;
  sizelimit: number;
  weightlimit: number;
  curtime: number;
  bits: string;
  height: number;
  difficulty: number;
}

interface RpcResponse {
  result: any;
  error: { message: string } | null;
  id: number;
}

export class BitcoinRpc {
  private requestId = 0;

  constructor(
    private config: BitcoinConfig,
    private logger: Logger
  ) {}

  private async call(method: string, params: any[] = []): Promise<any> {
    const auth = Buffer.from(`${this.config.rpcUser}:${this.config.rpcPass}`).toString('base64');
    
    const body = JSON.stringify({
      jsonrpc: '1.0',
      id: ++this.requestId,
      method,
      params
    });

    const url = `http://${this.config.rpcHost}:${this.config.rpcPort}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body
    });

    if (!response.ok) {
      throw new Error(`Bitcoin RPC error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as RpcResponse;
    
    if (data.error) {
      throw new Error(`Bitcoin RPC error: ${data.error.message}`);
    }

    return data.result;
  }

  async getBlockchainInfo(): Promise<BlockchainInfo> {
    return this.call('getblockchaininfo');
  }

  async getNetworkInfo(): Promise<NetworkInfo> {
    return this.call('getnetworkinfo');
  }

  async getMiningInfo(): Promise<MiningInfo> {
    return this.call('getmininginfo');
  }

  async getBlockTemplate(): Promise<BlockTemplate> {
    const template = await this.call('getblocktemplate', [{ rules: ['segwit'] }]);
    return {
      ...template,
      difficulty: this.targetToDifficulty(template.target)
    };
  }

  async submitBlock(blockHex: string): Promise<any> {
    return this.call('submitblock', [blockHex]);
  }

  async getBlock(blockhash: string, verbosity: number = 1): Promise<any> {
    return this.call('getblock', [blockhash, verbosity]);
  }

  async getBestBlockHash(): Promise<string> {
    return this.call('getbestblockhash');
  }

  async getBlockCount(): Promise<number> {
    return this.call('getblockcount');
  }

  async getDifficulty(): Promise<number> {
    return this.call('getdifficulty');
  }

  async getNetworkHashPs(blocks: number = 120): Promise<number> {
    return this.call('getnetworkhashps', [blocks]);
  }

  async getConnectionCount(): Promise<number> {
    return this.call('getconnectioncount');
  }

  async getMempoolInfo(): Promise<any> {
    return this.call('getmempoolinfo');
  }

  async estimateSmartFee(blocks: number = 6): Promise<any> {
    return this.call('estimatesmartfee', [blocks]);
  }

  private targetToDifficulty(target: string): number {
    const maxTarget = BigInt('0x00000000FFFF0000000000000000000000000000000000000000000000000000');
    const currentTarget = BigInt('0x' + target);
    return Number(maxTarget / currentTarget);
  }
}
