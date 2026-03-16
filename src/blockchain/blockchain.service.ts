import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract, JsonRpcProvider, Wallet, keccak256, solidityPacked } from 'ethers';
import { WalletResponseDto } from './dto/wallet.dto';
import { BLOCK_TIC_SBT_ABI } from './abi/BlockTicSBT.abi';
import { SIMPLE_ACCOUNT_FACTORY_ABI } from './abi/SimpleAccountFactory.abi';
import { VRF_CONSUMER_ABI } from './abi/VRFConsumer.abi';

/**
 * BlockchainService — Polygon PoS + ERC-4337 Account Abstraction layer.
 *
 * 架構說明：
 * ─────────
 * - 每位使用者在 KYC 完成時獲得一個 ERC-4337 Smart Contract Wallet (SCW)。
 *   錢包地址透過 SimpleAccountFactory.getAddress() 以 CREATE2 預先計算，
 *   實際部署延遲到第一筆 UserOperation（lazy deployment）。
 *
 * - 因 BlockTicSBT 合約所有寫入函數皆為 onlyOwner，平台使用 deployer EOA
 *   直接呼叫 mint / burn / recordDraw。使用者的 AA 錢包僅作為 SBT 接收地址。
 *
 * - 平台 Paymaster 概念上贊助所有 gas 費用 — 實務上因為平台 EOA 直接發交易，
 *   gas 由 deployer 帳戶支付，每筆操作成本 < NT$0.05。
 */
@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);

  private provider: JsonRpcProvider;
  private signer: Wallet;
  private sbtContract: Contract;
  private factoryContract: Contract;
  private vrfConsumerContract: Contract;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const rpcUrl = this.config.getOrThrow<string>('POLYGON_RPC_URL');
    const privateKey = this.config.getOrThrow<string>('POLYGON_PRIVATE_KEY');
    const sbtAddress = this.config.getOrThrow<string>('SBT_CONTRACT_ADDRESS');
    const factoryAddress = this.config.getOrThrow<string>('WALLET_FACTORY_ADDRESS');
    const vrfConsumerAddress = this.config.getOrThrow<string>('VRF_COORDINATOR_ADDRESS');

    this.provider = new JsonRpcProvider(rpcUrl);
    this.signer = new Wallet(privateKey, this.provider);

    this.sbtContract = new Contract(sbtAddress, BLOCK_TIC_SBT_ABI, this.signer);
    this.factoryContract = new Contract(factoryAddress, SIMPLE_ACCOUNT_FACTORY_ABI, this.provider);
    this.vrfConsumerContract = new Contract(vrfConsumerAddress, VRF_CONSUMER_ABI, this.signer);

    this.logger.log(
      `區塊鏈服務初始化完成 — Deployer: ${this.signer.address}`,
    );
  }

  /**
   * 為使用者建立 ERC-4337 AA 錢包（counterfactual address）。
   *
   * 透過 SimpleAccountFactory.getAddress(owner, salt) 計算確定性地址。
   * 錢包尚未部署到鏈上（lazy deployment），但地址可立即用於接收 SBT。
   *
   * @param userId - 平台使用者 ID，用於產生確定性 salt
   */
  async createAAWallet(userId: string): Promise<WalletResponseDto> {
    const salt = BigInt(keccak256(solidityPacked(['string'], [userId])));

    // 注意：不能直接呼叫 factoryContract.getAddress()，因為會與 Contract 內建方法衝突
    const getCounterfactualAddress = this.factoryContract.getFunction('getAddress');
    const walletAddress: string = await getCounterfactualAddress(this.signer.address, salt);

    this.logger.log(
      `AA 錢包已計算 — userId=${userId}, address=${walletAddress}`,
    );

    return {
      walletAddress,
      userId,
      isDeployed: false,
    };
  }

  /**
   * 鑄造 KYC 認證 SBT 到使用者的 AA 錢包。
   *
   * 呼叫 BlockTicSBT.mint(walletAddress, kycTokenId, 1)。
   * KYC token ID 範圍：1–999。
   *
   * @param walletAddress - 使用者的 AA 錢包地址
   * @param kycTokenId - KYC 認證 token ID (1–999)
   * @returns 交易 hash
   */
  async mintKycSbt(walletAddress: string, kycTokenId: number): Promise<string> {
    return this.sendContractTx(
      '鑄造 KYC SBT',
      () => this.sbtContract.mint(walletAddress, kycTokenId, 1),
    );
  }

  /**
   * 鑄造票券 SBT 到使用者的 AA 錢包（購票成功 / 中籤後）。
   *
   * 呼叫 BlockTicSBT.mint(walletAddress, ticketTokenId, 1)。
   * 票券 token ID 從 1000 起算。
   *
   * @param walletAddress - 使用者的 AA 錢包地址
   * @param ticketTokenId - 票券 token ID (1000+)
   * @returns 交易 hash
   */
  async mintTicketSbt(walletAddress: string, ticketTokenId: number): Promise<string> {
    return this.sendContractTx(
      '鑄造票券 SBT',
      () => this.sbtContract.mint(walletAddress, ticketTokenId, 1),
    );
  }

  /**
   * 銷毀使用者的票券 SBT（退票流程）。
   *
   * 呼叫 BlockTicSBT.burn(walletAddress, ticketTokenId, 1)。
   *
   * @param walletAddress - 使用者的 AA 錢包地址
   * @param ticketTokenId - 要銷毀的票券 token ID
   * @returns 交易 hash
   */
  async burnTicketSbt(walletAddress: string, ticketTokenId: number): Promise<string> {
    return this.sendContractTx(
      '銷毀票券 SBT',
      () => this.sbtContract.burn(walletAddress, ticketTokenId, 1),
    );
  }

  /**
   * 將 VRF 抽籤結果記錄到鏈上（透過 BlockTicSBT.recordDraw）。
   *
   * 此操作僅發出 DrawResult 事件，不鑄造任何 token。
   * 用於公平性稽核 — 任何人都可以透過鏈上事件驗證抽籤結果。
   *
   * @param eventId - 活動 ID
   * @param zoneId - 區域 ID
   * @param vrfRequestId - Chainlink VRF 請求 ID
   * @param randomSeed - VRF 回傳的隨機種子（uint256，以 bigint 傳入避免精度遺失）
   * @param winners - 中籤者錢包地址陣列
   * @returns 交易 hash
   */
  async recordDrawResult(
    eventId: number,
    zoneId: number,
    vrfRequestId: bigint,
    randomSeed: bigint,
    winners: string[],
  ): Promise<string> {
    return this.sendContractTx(
      `記錄抽籤結果 eventId=${eventId}`,
      () => this.sbtContract.recordDraw(eventId, zoneId, vrfRequestId, randomSeed, winners),
    );
  }

  /**
   * 驗證錢包是否持有特定 SBT（KYC 或票券）。
   *
   * 呼叫 BlockTicSBT.balanceOf(walletAddress, tokenId)，讀取鏈上狀態。
   * 這是 read-only 操作，不消耗 gas。
   *
   * @param walletAddress - 要查詢的錢包地址
   * @param tokenId - 要驗證的 token ID
   * @returns 是否持有該 token
   */
  async verifySbtOwnership(walletAddress: string, tokenId: number): Promise<boolean> {
    const balance: bigint = await this.sbtContract.balanceOf(walletAddress, tokenId);
    return balance > 0n;
  }

  /**
   * 向 Chainlink VRF Consumer 合約請求隨機數。
   *
   * 發送 requestRandomWords 交易後，輪詢等待 Chainlink 節點回填結果。
   * 回傳 VRF requestId 和 randomWord。
   *
   * @param maxWaitMs - 最長等待時間（預設 120 秒）
   * @param pollIntervalMs - 輪詢間隔（預設 5 秒）
   */
  async requestVrfRandomness(
    maxWaitMs = 120_000,
    pollIntervalMs = 5_000,
  ): Promise<{ vrfRequestId: bigint; randomWord: bigint }> {
    this.logger.log('VRF 隨機數請求 — 發送交易中...');

    const tx = await this.vrfConsumerContract.requestRandomWords();
    const receipt = await tx.wait();
    if (!receipt) {
      throw new InternalServerErrorException('VRF 請求交易被取消');
    }

    // 從合約取得最新 requestId
    const vrfRequestId: bigint = await this.vrfConsumerContract.lastRequestId();
    this.logger.log(`VRF 請求已送出 — requestId=${vrfRequestId}, txHash=${receipt.hash}`);

    // 輪詢等待 Chainlink 節點回填
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      const [fulfilled, randomWord]: [boolean, bigint] =
        await this.vrfConsumerContract.getRequestResult(vrfRequestId);

      if (fulfilled) {
        this.logger.log(`VRF 隨機數已回填 — requestId=${vrfRequestId}, randomWord=${randomWord}`);
        return { vrfRequestId, randomWord };
      }

      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }

    throw new InternalServerErrorException(
      `VRF 隨機數等待逾時 — requestId=${vrfRequestId}，超過 ${maxWaitMs / 1000} 秒`,
    );
  }

  /**
   * 共用的合約交易發送 + 等待確認 + 錯誤處理。
   */
  private async sendContractTx(
    label: string,
    txFn: () => Promise<{ wait: () => Promise<{ hash: string } | null> }>,
  ): Promise<string> {
    this.logger.log(`${label} — 發送交易中...`);

    try {
      const tx = await txFn();
      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error('交易被替換或取消，receipt 為 null');
      }

      this.logger.log(`${label} 完成 — txHash=${receipt.hash}`);
      return receipt.hash;
    } catch (error) {
      this.logger.error(`${label} 失敗 — ${error.message ?? error}`);
      throw new InternalServerErrorException(`區塊鏈交易失敗：${label}`);
    }
  }
}
