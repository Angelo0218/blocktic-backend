import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { keccak256, solidityPacked } from 'ethers';
import { LotteryEntry, LotteryEntryStatus } from './entities/lottery-entry.entity';
import { DrawResult } from './entities/draw-result.entity';
import { BlockchainService } from '../blockchain/blockchain.service';
import { IdentityService } from '../identity/identity.service';
import { RegisterLotteryDto } from './dto/register-lottery.dto';
import {
  DrawResultResponseDto,
  DrawResultEntryDto,
  DrawProofResponseDto,
} from './dto/draw-result.dto';

@Injectable()
export class LotteryService {
  private readonly logger = new Logger(LotteryService.name);

  constructor(
    @InjectRepository(LotteryEntry)
    private readonly entryRepo: Repository<LotteryEntry>,
    @InjectRepository(DrawResult)
    private readonly drawResultRepo: Repository<DrawResult>,
    private readonly blockchainService: BlockchainService,
    private readonly identityService: IdentityService,
  ) {}

  /**
   * Register a user for the lottery of a given event.
   */
  async register(
    eventId: string,
    userId: string,
    dto: RegisterLotteryDto,
  ): Promise<LotteryEntry> {
    const existing = await this.entryRepo.findOne({
      where: { eventId, userId },
    });
    if (existing) {
      throw new ConflictException('User already registered for this event lottery');
    }

    const entry = this.entryRepo.create({
      eventId,
      userId,
      zoneId: dto.zoneId,
      groupSize: dto.groupSize,
      status: LotteryEntryStatus.PENDING,
    });

    return this.entryRepo.save(entry);
  }

  /**
   * Trigger the lottery draw for an event.
   *
   * Steps:
   *  1. Request randomness from Chainlink VRF.
   *  2. Group entries by (zoneId, groupSize) into pools.
   *  3. For each pool, expand the VRF seed via keccak256 to produce a
   *     deterministic per-entry sort key, then sort and select winners.
   *  4. Record draw proof on-chain via BlockTicSBT.recordDraw().
   *  5. Persist the draw result and update entry statuses.
   */
  async draw(eventId: string): Promise<DrawResultResponseDto> {
    const entries = await this.entryRepo.find({ where: { eventId } });
    if (entries.length === 0) {
      throw new NotFoundException('No lottery entries found for this event');
    }

    const alreadyDrawn = await this.drawResultRepo.findOne({
      where: { eventId },
    });
    if (alreadyDrawn) {
      throw new ConflictException('Draw has already been executed for this event');
    }

    // ── Step 1: Request Chainlink VRF randomness ───────────
    const { vrfRequestId, randomWord } =
      await this.blockchainService.requestVrfRandomness();

    const randomSeedHex = `0x${randomWord.toString(16).padStart(64, '0')}`;

    // ── Step 2: Group entries into pools by zoneId + groupSize ──
    const pools = this.groupIntoPools(entries);

    // ── Step 3: For each pool, expand seed and sort to pick winners ──
    for (const [poolKey, poolEntries] of pools) {
      this.selectWinners(poolEntries, randomSeedHex, poolKey);
    }

    const winnerEntries = entries.filter((e) => e.status === LotteryEntryStatus.WON);

    // ── Step 4: 先持久化 DB（確保抽籤結果不遺失）──────────
    const drawResult = this.drawResultRepo.create({
      eventId,
      vrfRequestId: vrfRequestId.toString(),
      randomSeed: randomSeedHex,
      drawProofTxHash: null, // 鏈上記錄稍後補填
    });
    await this.drawResultRepo.save(drawResult);

    await Promise.all(
      entries.map((e) =>
        this.entryRepo.update(e.id, { status: e.status }),
      ),
    );

    // ── Step 5: Record draw proof on-chain（失敗不影響抽籤結果）──
    try {
      const winnerWallets = await this.resolveWalletAddresses(winnerEntries);
      const eventIdNum = parseInt(eventId.replace(/-/g, '').slice(0, 8), 16);

      const drawProofTxHash = await this.blockchainService.recordDrawResult(
        eventIdNum,
        0, // zoneId=0 表示整場活動
        vrfRequestId,
        randomWord,
        winnerWallets,
      );

      // 回填鏈上交易 hash
      await this.drawResultRepo.update(drawResult.id, { drawProofTxHash });
      await Promise.all(
        entries.map((e) =>
          this.entryRepo.update(e.id, { drawProofTxHash }),
        ),
      );

      this.logger.log(
        `抽籤完成 — eventId=${eventId}, 總報名=${entries.length}, ` +
          `中籤=${winnerEntries.length}, txHash=${drawProofTxHash}`,
      );
    } catch (error) {
      this.logger.error(
        `抽籤結果已儲存但鏈上記錄失敗 eventId=${eventId}，可稍後重試`,
        error,
      );
    }

    return this.buildDrawResultResponse(eventId);
  }

  /**
   * Get draw results for an event.
   */
  async getResults(eventId: string): Promise<DrawResultResponseDto> {
    return this.buildDrawResultResponse(eventId);
  }

  /**
   * Get on-chain proof details for a draw.
   */
  async getProof(eventId: string): Promise<DrawProofResponseDto> {
    const drawResult = await this.drawResultRepo.findOne({
      where: { eventId },
    });
    if (!drawResult) {
      throw new NotFoundException('No draw result found for this event');
    }

    return {
      eventId,
      vrfRequestId: drawResult.vrfRequestId,
      randomSeed: drawResult.randomSeed,
      drawProofTxHash: drawResult.drawProofTxHash,
      drawnAt: drawResult.drawnAt,
    };
  }

  // ----------------------------------------------------------------
  // Private helpers
  // ----------------------------------------------------------------

  /**
   * Group lottery entries into pools keyed by "zoneId:groupSize".
   */
  private groupIntoPools(
    entries: LotteryEntry[],
  ): Map<string, LotteryEntry[]> {
    const pools = new Map<string, LotteryEntry[]>();
    for (const entry of entries) {
      const key = `${entry.zoneId}:${entry.groupSize}`;
      const pool = pools.get(key) ?? [];
      pool.push(entry);
      pools.set(key, pool);
    }
    return pools;
  }

  /**
   * 使用 keccak256 展開 VRF 種子，為每個 entry 產生確定性排序鍵，
   * 排序後取前 N 名為中籤者。
   *
   * keccak256(seed, poolKey, entryId) 可在鏈上重現驗證。
   */
  private selectWinners(
    entries: LotteryEntry[],
    randomSeed: string,
    poolKey: string,
  ): void {
    const sorted = entries
      .map((entry) => {
        const sortKey = keccak256(
          solidityPacked(
            ['string', 'string', 'string'],
            [randomSeed, poolKey, entry.id],
          ),
        );
        return { entry, sortKey };
      })
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    // 選取 50% 為中籤者（正式環境可依活動設定調整）
    const winnerCount = Math.max(1, Math.ceil(sorted.length * 0.5));

    sorted.forEach(({ entry }, index) => {
      entry.status =
        index < winnerCount
          ? LotteryEntryStatus.WON
          : LotteryEntryStatus.LOST;
    });
  }

  /**
   * 將中籤者的 userId 解析為 AA 錢包地址（用於鏈上記錄）。
   * 若使用者尚未完成 KYC（無錢包），使用零地址佔位。
   */
  private async resolveWalletAddresses(
    winnerEntries: LotteryEntry[],
  ): Promise<string[]> {
    const addresses: string[] = [];
    for (const entry of winnerEntries) {
      try {
        const kyc = await this.identityService.getKycStatus(entry.userId);
        addresses.push(kyc.aaWalletAddress ?? '0x' + '0'.repeat(40));
      } catch {
        addresses.push('0x' + '0'.repeat(40));
      }
    }
    return addresses;
  }

  /**
   * Build a full draw result response DTO.
   */
  private async buildDrawResultResponse(
    eventId: string,
  ): Promise<DrawResultResponseDto> {
    const drawResult = await this.drawResultRepo.findOne({
      where: { eventId },
    });
    const entries = await this.entryRepo.find({ where: { eventId } });

    const entryDtos: DrawResultEntryDto[] = entries.map((e) => ({
      id: e.id,
      userId: e.userId,
      zoneId: e.zoneId,
      groupSize: e.groupSize,
      status: e.status,
      drawProofTxHash: e.drawProofTxHash,
    }));

    return {
      eventId,
      vrfRequestId: drawResult?.vrfRequestId ?? null,
      randomSeed: drawResult?.randomSeed ?? null,
      drawProofTxHash: drawResult?.drawProofTxHash ?? null,
      drawnAt: drawResult?.drawnAt ?? null,
      entries: entryDtos,
    };
  }
}
