import net from 'net';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { BitcoinRpc } from '../bitcoin/bitcoin-rpc';
import { PoolState } from '../pool/pool-state';
import { Logger } from 'pino';

interface StratumConfig {
  port: number;
  difficulty: number;
  vardiffTarget: number;
  vardiffRetargetTime: number;
  vardiffVariance: number;
  poolName: string;
}

interface StratumClient {
  id: string;
  socket: net.Socket;
  address: string;
  workerName: string;
  difficulty: number;
  extraNonce1: string;
  authorized: boolean;
  subscribed: boolean;
  hashrate: number;
  sharesAccepted: number;
  sharesRejected: number;
  bestDifficulty: number;
  lastShare: number;
  connectedAt: number;
}

interface BlockTemplate {
  version: number;
  previousblockhash: string;
  transactions: any[];
  coinbasevalue: number;
  bits: string;
  height: number;
  curtime: number;
  target: string;
  difficulty: number;
}

export class StratumServer {
  private server: net.Server;
  private clients: Map<string, StratumClient> = new Map();
  private extraNonceCounter = 0;
  private currentJob: any = null;
  private jobCounter = 0;
  private blockTemplate: BlockTemplate | null = null;

  constructor(
    private config: StratumConfig,
    private bitcoinRpc: BitcoinRpc,
    private poolState: PoolState,
    private logger: Logger
  ) {
    this.server = net.createServer((socket) => {
      socket.setNoDelay(true);
      this.handleConnection(socket);
    });
  }

  async start(): Promise<void> {
    // Start block template refresh
    this.refreshBlockTemplate();
    setInterval(() => this.refreshBlockTemplate(), 10000);

    return new Promise((resolve) => {
      this.server.listen(this.config.port, '0.0.0.0', () => {
        resolve();
      });
    });
  }

  stop(): void {
    this.server.close();
    this.clients.forEach((client) => client.socket.destroy());
  }

  private async refreshBlockTemplate(): Promise<void> {
    try {
      this.blockTemplate = await this.bitcoinRpc.getBlockTemplate();
      this.createJob();
      this.logger.info({ 
        height: this.blockTemplate.height,
        difficulty: this.blockTemplate.difficulty,
        txCount: this.blockTemplate.transactions?.length || 0
      }, 'New block template received');
      this.broadcastJob(false);
    } catch (error: any) {
      this.logger.error({ error: error.message }, 'Failed to refresh block template');
    }
  }

  private createJob(): void {
    if (!this.blockTemplate) return;

    this.jobCounter++;
    const jobId = this.jobCounter.toString(16).padStart(8, '0');

    // Build merkle branches from transaction hashes (matches public-pool format)
    const merkleBranches = this.buildMerkleBranches(this.blockTemplate.transactions);

    // prevHash: first reverse all bytes (little endian), then swap 4-byte words
    // This matches public-pool's approach: convertToLittleEndian + swapEndianWords
    const prevHashLE = this.convertToLittleEndian(this.blockTemplate.previousblockhash);
    const prevHashSwapped = this.swapEndianWords(prevHashLE);
    
    // Version as hex string (no reversal needed - matches public-pool)
    const versionHex = this.blockTemplate.version.toString(16).padStart(8, '0');
    
    // Bits as hex string (parse if needed, then format)
    const bitsHex = this.blockTemplate.bits;
    
    // Timestamp as hex
    const ntimeHex = this.blockTemplate.curtime.toString(16).padStart(8, '0');
    
    this.currentJob = {
      id: jobId,
      prevHash: prevHashSwapped.toString('hex'),
      prevHashBuffer: prevHashLE, // Keep for block building
      coinbaseValue: this.blockTemplate.coinbasevalue,
      merkleBranches,
      version: versionHex,
      nbits: bitsHex,
      ntime: ntimeHex,
      height: this.blockTemplate.height,
      cleanJobs: true,
      target: this.blockTemplate.target,
      difficulty: this.blockTemplate.difficulty
    };
  }

  private buildCoinbase(client: StratumClient, extraNonce2: string): { coinbase: string; coinbaseHash: string } {
    if (!this.blockTemplate || !this.currentJob) {
      return { coinbase: '', coinbaseHash: '' };
    }

    const height = this.blockTemplate.height;
    const coinbaseValue = this.blockTemplate.coinbasevalue;

    // Build coinbase script signature (scriptSig)
    const heightScript = this.encodeHeight(height);
    const poolMarker = Buffer.from(`/${this.config.poolName}/`, 'utf8');
    const extraNonce = client.extraNonce1 + extraNonce2;
    
    const scriptSig = Buffer.concat([
      heightScript,
      poolMarker,
      Buffer.from(extraNonce, 'hex')
    ]);

    // Build segwit coinbase transaction (version 2)
    // Non-witness serialization for txid calculation
    let coinbaseTxNoWitness = '02000000'; // Version 2
    coinbaseTxNoWitness += '01'; // Input count
    coinbaseTxNoWitness += '0000000000000000000000000000000000000000000000000000000000000000';
    coinbaseTxNoWitness += 'ffffffff';
    coinbaseTxNoWitness += scriptSig.length.toString(16).padStart(2, '0');
    coinbaseTxNoWitness += scriptSig.toString('hex');
    coinbaseTxNoWitness += 'ffffffff';
    
    // Two outputs: payout + witness commitment
    coinbaseTxNoWitness += '02';
    
    // Output 1: Payout
    const valueBuffer = Buffer.alloc(8);
    valueBuffer.writeBigUInt64LE(BigInt(coinbaseValue));
    coinbaseTxNoWitness += valueBuffer.toString('hex');
    const outputScript = this.buildOutputScript(client.address);
    coinbaseTxNoWitness += (outputScript.length / 2).toString(16).padStart(2, '0');
    coinbaseTxNoWitness += outputScript;
    
    // Output 2: Witness commitment (value 0)
    coinbaseTxNoWitness += '0000000000000000';
    const witnessCommitment = this.calculateWitnessCommitment();
    const witnessScript = '6a24aa21a9ed' + witnessCommitment;
    coinbaseTxNoWitness += (witnessScript.length / 2).toString(16).padStart(2, '0');
    coinbaseTxNoWitness += witnessScript;
    
    // Locktime
    coinbaseTxNoWitness += '00000000';

    // Calculate txid (hash of non-witness serialization)
    const coinbaseBuffer = Buffer.from(coinbaseTxNoWitness, 'hex');
    const hash1 = crypto.createHash('sha256').update(coinbaseBuffer).digest();
    const hash2 = crypto.createHash('sha256').update(hash1).digest();
    
    // Full coinbase tx with witness data for block submission
    let coinbaseTxFull = '02000000'; // Version 2
    coinbaseTxFull += '0001'; // SegWit marker + flag
    coinbaseTxFull += '01'; // Input count
    coinbaseTxFull += '0000000000000000000000000000000000000000000000000000000000000000';
    coinbaseTxFull += 'ffffffff';
    coinbaseTxFull += scriptSig.length.toString(16).padStart(2, '0');
    coinbaseTxFull += scriptSig.toString('hex');
    coinbaseTxFull += 'ffffffff';
    coinbaseTxFull += '02';
    coinbaseTxFull += valueBuffer.toString('hex');
    coinbaseTxFull += (outputScript.length / 2).toString(16).padStart(2, '0');
    coinbaseTxFull += outputScript;
    coinbaseTxFull += '0000000000000000';
    coinbaseTxFull += (witnessScript.length / 2).toString(16).padStart(2, '0');
    coinbaseTxFull += witnessScript;
    // Witness stack: 1 element of 32 bytes (all zeros)
    coinbaseTxFull += '01200000000000000000000000000000000000000000000000000000000000000000';
    coinbaseTxFull += '00000000';

    return {
      coinbase: coinbaseTxFull,
      coinbaseHash: hash2.toString('hex')
    };
  }

  private buildOutputScript(address: string): string {
    // Handle different address formats
    if (!address || address.length < 26) {
      // Fallback to OP_RETURN if no valid address
      return '6a'; // OP_RETURN (unspendable - miner must provide valid address)
    }

    // For legacy P2PKH addresses (start with 1)
    if (address.startsWith('1')) {
      try {
        const decoded = this.base58Decode(address);
        const pubKeyHash = decoded.slice(1, 21);
        return '76a914' + pubKeyHash.toString('hex') + '88ac';
      } catch {
        return '6a';
      }
    }
    
    // For P2SH addresses (start with 3)
    if (address.startsWith('3')) {
      try {
        const decoded = this.base58Decode(address);
        const scriptHash = decoded.slice(1, 21);
        return 'a914' + scriptHash.toString('hex') + '87';
      } catch {
        return '6a';
      }
    }
    
    // For native SegWit addresses (start with bc1)
    if (address.toLowerCase().startsWith('bc1')) {
      try {
        const { version, program } = this.decodeBech32(address);
        if (version === 0 && program.length === 20) {
          // P2WPKH
          return '0014' + Buffer.from(program).toString('hex');
        } else if (version === 0 && program.length === 32) {
          // P2WSH
          return '0020' + Buffer.from(program).toString('hex');
        } else if (version === 1 && program.length === 32) {
          // P2TR (Taproot)
          return '5120' + Buffer.from(program).toString('hex');
        }
      } catch {
        return '6a';
      }
    }

    // Unknown format - return OP_RETURN
    return '6a';
  }

  private base58Decode(str: string): Buffer {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let num = BigInt(0);
    for (const char of str) {
      const index = ALPHABET.indexOf(char);
      if (index === -1) throw new Error('Invalid base58 character');
      num = num * BigInt(58) + BigInt(index);
    }
    
    let hex = num.toString(16);
    if (hex.length % 2) hex = '0' + hex;
    
    // Count leading zeros
    let leadingZeros = 0;
    for (const char of str) {
      if (char === '1') leadingZeros++;
      else break;
    }
    
    return Buffer.concat([
      Buffer.alloc(leadingZeros),
      Buffer.from(hex, 'hex')
    ]);
  }

  private decodeBech32(address: string): { version: number; program: number[] } {
    const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    const lower = address.toLowerCase();
    const pos = lower.lastIndexOf('1');
    const hrp = lower.slice(0, pos);
    const data = lower.slice(pos + 1);
    
    const values: number[] = [];
    for (const char of data) {
      const index = CHARSET.indexOf(char);
      if (index === -1) throw new Error('Invalid bech32 character');
      values.push(index);
    }
    
    // Remove checksum (last 6 characters)
    const conv = values.slice(0, -6);
    
    // Convert from 5-bit to 8-bit
    const version = conv[0];
    const program: number[] = [];
    let acc = 0;
    let bits = 0;
    
    for (let i = 1; i < conv.length; i++) {
      acc = (acc << 5) | conv[i];
      bits += 5;
      while (bits >= 8) {
        bits -= 8;
        program.push((acc >> bits) & 0xff);
      }
    }
    
    return { version, program };
  }

  private encodeHeight(height: number): Buffer {
    if (height < 17) {
      return Buffer.from([0x50 + height]);
    }
    
    const buf: number[] = [];
    let n = height;
    while (n > 0) {
      buf.push(n & 0xff);
      n >>= 8;
    }
    
    // Add sign byte if needed
    if (buf[buf.length - 1] & 0x80) {
      buf.push(0);
    }
    
    return Buffer.concat([
      Buffer.from([buf.length]),
      Buffer.from(buf)
    ]);
  }

  private buildMerkleBranches(transactions: any[]): string[] {
    if (!transactions || transactions.length === 0) return [];
    
    // Get transaction hashes - use txid field and reverse to little-endian
    // In stratum, merkle branches are used to compute merkle root from coinbase
    // We need to build tree with coinbase at position 0, get sibling hashes
    const txHashes: Buffer[] = transactions.map((tx: any) => {
      const hash = tx.txid || tx.hash;
      return Buffer.from(hash, 'hex').reverse();
    });

    // Insert placeholder coinbase at position 0 (32 zero bytes - will be replaced by miner)
    const allHashes: Buffer[] = [Buffer.alloc(32, 0), ...txHashes];

    // Build merkle tree and get proof for position 0 (coinbase)
    return this.getMerkleProof(allHashes, 0);
  }

  // Get merkle proof for a given index - returns sibling hashes to reach root
  // Matches public-pool's merkle-lib/proof approach
  private getMerkleProof(hashes: Buffer[], index: number): string[] {
    if (hashes.length === 0) return [];
    if (hashes.length === 1) return [];
    
    const proof: string[] = [];
    let level = [...hashes];
    let currentIndex = index;
    
    while (level.length > 1) {
      // Get sibling index
      const siblingIndex = (currentIndex % 2 === 0) ? currentIndex + 1 : currentIndex - 1;
      
      // Add sibling to proof (use duplicate if at end)
      if (siblingIndex < level.length) {
        proof.push(level[siblingIndex].toString('hex'));
      } else {
        proof.push(level[currentIndex].toString('hex'));
      }
      
      // Build next level
      const nextLevel: Buffer[] = [];
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = level[i + 1] || left;
        nextLevel.push(this.doubleSha256(Buffer.concat([left, right])));
      }
      
      // Update index for next level
      currentIndex = Math.floor(currentIndex / 2);
      level = nextLevel;
    }
    
    return proof;
  }

  private doubleSha256(data: Buffer): Buffer {
    const hash1 = crypto.createHash('sha256').update(data).digest();
    return crypto.createHash('sha256').update(hash1).digest();
  }

  private calculateMerkleRoot(coinbaseHash: string, branches: string[]): string {
    let hash = coinbaseHash;
    
    for (const branch of branches) {
      const combined = Buffer.concat([
        Buffer.from(hash, 'hex'),
        Buffer.from(branch, 'hex')
      ]);
      const hash1 = crypto.createHash('sha256').update(combined).digest();
      const hash2 = crypto.createHash('sha256').update(hash1).digest();
      hash = hash2.toString('hex');
    }
    
    return hash;
  }

  private reverseBytePairs(hex: string): string {
    const bytes = hex.match(/.{2}/g) || [];
    return bytes.reverse().join('');
  }

  private reverseHex(hex: string): string {
    return Buffer.from(hex, 'hex').reverse().toString('hex');
  }

  // Swap 4-byte words (endian swap within each 4-byte segment) - matches public-pool
  private swapEndianWords(buffer: Buffer): Buffer {
    const swappedBuffer = Buffer.alloc(buffer.length);
    for (let i = 0; i < buffer.length; i += 4) {
      swappedBuffer[i] = buffer[i + 3];
      swappedBuffer[i + 1] = buffer[i + 2];
      swappedBuffer[i + 2] = buffer[i + 1];
      swappedBuffer[i + 3] = buffer[i];
    }
    return swappedBuffer;
  }

  // Convert to little endian (reverse bytes) - matches public-pool
  private convertToLittleEndian(hash: string): Buffer {
    const bytes = Buffer.from(hash, 'hex');
    return bytes.reverse();
  }

  private handleConnection(socket: net.Socket): void {
    socket.setEncoding('utf8');
    socket.setNoDelay(true);

    const clientId = uuidv4();
    const extraNonce1 = (++this.extraNonceCounter).toString(16).padStart(8, '0');

    const client: StratumClient = {
      id: clientId,
      socket,
      address: '',
      workerName: '',
      difficulty: this.config.difficulty,
      extraNonce1,
      authorized: false,
      subscribed: false,
      hashrate: 0,
      sharesAccepted: 0,
      sharesRejected: 0,
      bestDifficulty: 0,
      lastShare: 0,
      connectedAt: Date.now()
    };

    this.clients.set(clientId, client);
    this.poolState.addClient(client);

    let buffer = '';

    socket.on('data', (data: string) => {
      buffer += data;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line);
            this.handleMessage(client, message);
          } catch (e) {
            this.logger.debug({ line }, 'Invalid JSON from client');
          }
        }
      }
    });

    socket.on('error', (error) => {
      this.logger.debug({ clientId, error: error.message }, 'Socket error');
    });

    socket.on('close', () => {
      this.clients.delete(clientId);
      this.poolState.removeClient(clientId);
      this.logger.debug({ clientId, worker: client.workerName }, 'Client disconnected');
    });
  }

  private handleMessage(client: StratumClient, message: any): void {
    const { id, method, params } = message;

    switch (method) {
      case 'mining.subscribe':
        this.handleSubscribe(client, id, params);
        break;
      case 'mining.authorize':
        this.handleAuthorize(client, id, params);
        break;
      case 'mining.submit':
        this.handleSubmit(client, id, params);
        break;
      case 'mining.extranonce.subscribe':
        this.sendResponse(client, id, true);
        break;
      case 'mining.configure':
        this.handleConfigure(client, id, params);
        break;
      default:
        this.logger.debug({ method }, 'Unknown stratum method');
    }
  }

  private handleSubscribe(client: StratumClient, id: number, params: any[]): void {
    client.subscribed = true;

    const result = [
      [
        ['mining.set_difficulty', uuidv4()],
        ['mining.notify', uuidv4()]
      ],
      client.extraNonce1,
      4 // extraNonce2 size
    ];

    this.sendResponse(client, id, result);
    this.sendDifficulty(client);
    
    // Do NOT send job here - wait for authorization to get the miner's address
    // The job will be sent in handleAuthorize after we have the address
  }

  private handleAuthorize(client: StratumClient, id: number, params: any[]): void {
    const [fullWorkerName, password] = params;
    
    // Parse address.worker format
    const [address, workerName] = fullWorkerName.split('.');
    
    client.address = address;
    client.workerName = workerName || 'default';
    client.authorized = true;

    this.poolState.updateClient(client);
    
    this.sendResponse(client, id, true);
    this.logger.info({ 
      address: client.address, 
      worker: client.workerName 
    }, 'Worker authorized');

    // Send job now that we have the address for the coinbase
    if (this.currentJob) {
      this.sendJob(client, true);
      this.logger.info({ 
        worker: client.workerName, 
        jobId: this.currentJob.id,
        height: this.currentJob.height
      }, 'Job sent to worker');
    } else {
      this.logger.warn({ worker: client.workerName }, 'No job available to send');
    }
  }

  private handleSubmit(client: StratumClient, id: number, params: any[]): void {
    this.logger.info({ worker: client.workerName, params }, 'Share submission received');
    
    if (!client.authorized) {
      this.sendResponse(client, id, null, [24, 'Unauthorized worker', null]);
      return;
    }

    const [workerName, jobId, extraNonce2, ntime, nonce] = params;
    
    // Build coinbase and calculate share
    const { coinbase, coinbaseHash } = this.buildCoinbase(client, extraNonce2);
    
    if (!coinbaseHash) {
      this.sendResponse(client, id, null, [20, 'Internal error', null]);
      return;
    }

    // Calculate merkle root
    const merkleRoot = this.calculateMerkleRoot(
      coinbaseHash, 
      this.currentJob?.merkleBranches || []
    );

    // Build block header
    const blockHeader = this.buildBlockHeader(
      this.currentJob?.version,
      this.currentJob?.prevHash,
      merkleRoot,
      ntime,
      this.currentJob?.nbits,
      nonce
    );

    // Calculate share difficulty
    const shareDifficulty = this.calculateShareDifficulty(blockHeader);

    if (shareDifficulty >= client.difficulty) {
      client.sharesAccepted++;
      client.lastShare = Date.now();
      
      if (shareDifficulty > client.bestDifficulty) {
        client.bestDifficulty = shareDifficulty;
        this.poolState.updateBestDifficulty(client.address, shareDifficulty);
      }

      // Calculate hashrate based on share difficulty and time
      this.updateHashrate(client, shareDifficulty);
      
      this.poolState.recordShare(client, shareDifficulty, true);
      this.sendResponse(client, id, true);
      
      this.logger.debug({ 
        worker: client.workerName, 
        difficulty: shareDifficulty.toFixed(2) 
      }, 'Share accepted');

      // Check if block was found
      const networkDifficulty = this.currentJob?.difficulty || 0;
      if (shareDifficulty >= networkDifficulty && networkDifficulty > 0) {
        this.logger.info({ 
          worker: client.workerName, 
          address: client.address,
          difficulty: shareDifficulty 
        }, 'BLOCK FOUND!');
        this.submitBlock(client, coinbase, blockHeader);
      }
    } else {
      client.sharesRejected++;
      this.poolState.recordShare(client, shareDifficulty, false);
      this.sendResponse(client, id, null, [23, 'Low difficulty share', null]);
    }
  }

  private buildBlockHeader(
    version: string,
    prevHash: string,
    merkleRoot: string,
    ntime: string,
    bits: string,
    nonce: string
  ): Buffer {
    return Buffer.concat([
      Buffer.from(version, 'hex'),
      Buffer.from(prevHash, 'hex'),
      Buffer.from(merkleRoot, 'hex'),
      Buffer.from(ntime, 'hex'),
      Buffer.from(bits, 'hex'),
      Buffer.from(nonce, 'hex')
    ]);
  }

  private calculateShareDifficulty(headerBuffer: Buffer): number {
    // Double SHA256
    const hash1 = crypto.createHash('sha256').update(headerBuffer).digest();
    const hash2 = crypto.createHash('sha256').update(hash1).digest();
    
    // Calculate difficulty from hash
    // Difficulty 1 target = 0x00000000FFFF...
    const hashBigInt = BigInt('0x' + hash2.reverse().toString('hex'));
    
    if (hashBigInt === BigInt(0)) return 0;
    
    const maxTarget = BigInt('0x00000000FFFF0000000000000000000000000000000000000000000000000000');
    const difficulty = Number(maxTarget / hashBigInt);
    
    return difficulty;
  }

  private handleConfigure(client: StratumClient, id: number, params: any[]): void {
    const [extensions, extensionParams] = params;
    const result: any = {};
    
    if (extensions.includes('version-rolling')) {
      result['version-rolling'] = true;
      result['version-rolling.mask'] = '1fffe000';
    }
    
    this.sendResponse(client, id, result);
  }

  private updateHashrate(client: StratumClient, shareDifficulty: number): void {
    const now = Date.now();
    const timeDiff = (now - (client.lastShare || client.connectedAt)) / 1000;
    
    if (timeDiff > 0 && timeDiff < 600) {
      // Hashrate = difficulty * 2^32 / time
      const instantHashrate = (shareDifficulty * 4294967296) / timeDiff;
      // Smooth with exponential moving average
      client.hashrate = client.hashrate * 0.8 + instantHashrate * 0.2;
    }
    
    this.poolState.updateClient(client);
  }

  private async submitBlock(client: StratumClient, coinbase: string, header: Buffer): Promise<void> {
    try {
      if (!this.blockTemplate) return;

      // Build full block
      let blockHex = header.toString('hex');
      
      // Add transaction count
      const txCount = 1 + (this.blockTemplate.transactions?.length || 0);
      if (txCount < 0xfd) {
        blockHex += txCount.toString(16).padStart(2, '0');
      } else if (txCount <= 0xffff) {
        blockHex += 'fd' + txCount.toString(16).padStart(4, '0');
      }
      
      // Add coinbase transaction
      blockHex += coinbase;
      
      // Add other transactions
      for (const tx of this.blockTemplate.transactions || []) {
        blockHex += tx.data;
      }

      this.logger.info({ 
        address: client.address,
        worker: client.workerName,
        height: this.blockTemplate.height
      }, 'Submitting block to Bitcoin Core');

      const result = await this.bitcoinRpc.submitBlock(blockHex);
      
      if (result === null) {
        this.logger.info({ height: this.blockTemplate.height }, 'Block accepted by network!');
        this.poolState.recordBlockFound(client.address, client.workerName);
      } else {
        this.logger.warn({ result }, 'Block rejected');
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to submit block');
    }
  }

  private sendResponse(client: StratumClient, id: number, result: any, error: any = null): void {
    const response = JSON.stringify({ id, result, error }) + '\n';
    client.socket.write(response);
  }

  private sendDifficulty(client: StratumClient): void {
    const message = JSON.stringify({
      id: null,
      method: 'mining.set_difficulty',
      params: [client.difficulty]
    }) + '\n';
    client.socket.write(message);
  }

  private sendJob(client: StratumClient, cleanJobs: boolean): void {
    if (!this.currentJob || !this.blockTemplate) return;

    // Build coinbase parts for this client
    const coinbase1 = this.buildCoinbasePart1(client);
    const coinbase2 = this.buildCoinbasePart2(client);

    const params = [
      this.currentJob.id,
      this.currentJob.prevHash,
      coinbase1,
      coinbase2,
      this.currentJob.merkleBranches,
      this.currentJob.version,
      this.currentJob.nbits,
      this.currentJob.ntime,
      cleanJobs
    ];

    this.logger.debug({ 
      jobId: this.currentJob.id,
      prevHashLen: this.currentJob.prevHash.length,
      coinbase1Len: coinbase1.length,
      coinbase2Len: coinbase2.length,
      merkleCount: this.currentJob.merkleBranches.length,
      version: this.currentJob.version,
      nbits: this.currentJob.nbits,
      ntime: this.currentJob.ntime
    }, 'Sending job details');

    const message = JSON.stringify({
      id: null,
      method: 'mining.notify',
      params
    }) + '\n';
    client.socket.write(message);
  }

  private buildCoinbasePart1(client: StratumClient): string {
    if (!this.blockTemplate) return '';

    const height = this.blockTemplate.height;
    const heightScript = this.encodeHeight(height);
    const poolMarker = Buffer.from(`/${this.config.poolName}/`, 'utf8');
    
    // NON-WITNESS serialization for stratum (no marker/flag)
    // Version 2 (matches public-pool)
    let part1 = '02000000'; // Version 2
    part1 += '01'; // Input count
    part1 += '0000000000000000000000000000000000000000000000000000000000000000';
    part1 += 'ffffffff';
    
    // Script content before extranonce (with 8 bytes for extranonce1 + extranonce2)
    const scriptPrefix = Buffer.concat([heightScript, poolMarker]);
    const totalScriptLen = scriptPrefix.length + 8; // 8 bytes for extranonces
    
    part1 += totalScriptLen.toString(16).padStart(2, '0');
    part1 += scriptPrefix.toString('hex');
    
    return part1;
  }

  private buildCoinbasePart2(client: StratumClient): string {
    if (!this.blockTemplate) return '';

    const coinbaseValue = this.blockTemplate.coinbasevalue;
    
    // Sequence (continues after extranonces)
    let part2 = 'ffffffff';
    
    // Output count: 2 outputs (payout + witness commitment)
    part2 += '02';
    
    // Output 1: Payout to miner's address
    const valueBuffer = Buffer.alloc(8);
    valueBuffer.writeBigUInt64LE(BigInt(coinbaseValue));
    part2 += valueBuffer.toString('hex');
    
    const outputScript = client.address ? this.buildOutputScript(client.address) : '6a';
    part2 += (outputScript.length / 2).toString(16).padStart(2, '0');
    part2 += outputScript;
    
    // Output 2: Witness commitment (OP_RETURN)
    part2 += '0000000000000000'; // Value: 0
    
    // Witness commitment script: OP_RETURN + PUSH 36 + header + commitment
    const witnessCommitment = this.calculateWitnessCommitment();
    const witnessScript = '6a24aa21a9ed' + witnessCommitment;
    part2 += (witnessScript.length / 2).toString(16).padStart(2, '0');
    part2 += witnessScript;
    
    // Locktime (NO witness data in stratum coinbase - only for block submission)
    part2 += '00000000';
    
    return part2;
  }

  // Calculate witness commitment for the coinbase transaction
  private calculateWitnessCommitment(): string {
    if (!this.blockTemplate) return '0000000000000000000000000000000000000000000000000000000000000000';
    
    // Witness root hash = merkle root of all wtxids (coinbase wtxid is all zeros)
    const witnessReservedValue = Buffer.alloc(32, 0);
    
    // Get witness txids from transactions
    const wtxids: Buffer[] = [Buffer.alloc(32, 0)]; // Coinbase wtxid is all zeros
    
    for (const tx of this.blockTemplate.transactions || []) {
      // Use wtxid (hash) if available, otherwise use txid
      const wtxid = tx.hash || tx.txid;
      wtxids.push(Buffer.from(wtxid, 'hex').reverse());
    }
    
    // Calculate witness merkle root
    const witnessRoot = this.calculateMerkleRootFromBuffers(wtxids);
    
    // Commitment = double_sha256(witnessRoot || witnessReservedValue)
    const commitment = this.doubleSha256(Buffer.concat([witnessRoot, witnessReservedValue]));
    
    return commitment.toString('hex');
  }

  private calculateMerkleRootFromBuffers(hashes: Buffer[]): Buffer {
    if (hashes.length === 0) return Buffer.alloc(32, 0);
    if (hashes.length === 1) return hashes[0];
    
    let level = hashes;
    while (level.length > 1) {
      const nextLevel: Buffer[] = [];
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = level[i + 1] || left;
        nextLevel.push(this.doubleSha256(Buffer.concat([left, right])));
      }
      level = nextLevel;
    }
    
    return level[0];
  }

  private broadcastJob(cleanJobs: boolean): void {
    this.clients.forEach((client) => {
      if (client.subscribed) {
        this.sendJob(client, cleanJobs);
      }
    });
  }

  getClients(): Map<string, StratumClient> {
    return this.clients;
  }

  getClientCount(): number {
    return this.clients.size;
  }
}
