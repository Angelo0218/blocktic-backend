import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { keccak256, solidityPacked } from 'ethers';
import { LotteryEntry, LotteryEntryStatus } from './entities/lottery-entry.entity';
import { DrawResult } from './entities/draw-result.entity';
import { Seat, SeatStatus } from '../seat-allocation/entities/seat.entity';
import { BlockchainService } from '../blockchain/blockchain.service';
import { IdentityService } from '../identity/identity.service';
import { RegisterLotteryDto } from './dto/register-lottery.dto';
import {
  DrawResultResponseDto,
  DrawResultEntryDto,
  DrawProofResponseDto,
} from './dto/draw-result.dto';
import {
  findConsecutiveSeats,
  pickScatteredSeats,
} from '../common/utils/seat-utils';

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
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 為使用者報名活動抽籤。
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
   * 觸發活動抽籤，同時原子化分配座位。
   *
   * 流程：
   *  1. 請求 Chainlink VRF 隨機數
   *  2. 為每筆報名計算全域排序鍵（keccak256）
   *  3. 按 zoneId 分組，每區在同一筆 DB 交易中：
   *     - 鎖定該區所有可用座位（FOR UPDATE SKIP LOCKED）
   *     - 按 VRF 順序逐一分配座位（先連號、再散座）
   *     - 座位用完即標記 LOST，杜絕超賣
   *  4. 儲存抽籤結果並上鏈記錄
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

    // ── Step 1: 請求 Chainlink VRF 隨機數 ─────────────
    const { vrfRequestId, randomWord } =
      await this.blockchainService.requestVrfRandomness();

    const randomSeedHex = `0x${randomWord.toString(16).padStart(64, '0')}`;

    // ── Step 2: 計算全域排序鍵並按 zone 分組 ──────────
    const sortedEntries = this.computeGlobalSortKeys(entries, randomSeedHex);
    const zoneGroups = this.groupByZone(sortedEntries);

    // ── Step 3: 每區獨立交易，原子化抽籤 + 配位 ─────────
    for (const [zoneId, zoneEntries] of zoneGroups) {
      await this.allocateZone(eventId, zoneId, zoneEntries);
    }

    const winnerEntries = entries.filter(
      (e) => e.status === LotteryEntryStatus.WON,
    );

    // ── Step 4: 先持久化 DB（確保抽籤結果不遺失）────────
    const drawResult = this.drawResultRepo.create({
      eventId,
      vrfRequestId: vrfRequestId.toString(),
      randomSeed: randomSeedHex,
      drawProofTxHash: null,
    });
    await this.drawResultRepo.save(drawResult);

    await Promise.all(
      entries.map((e) =>
        this.entryRepo.update(e.id, {
          status: e.status,
          allocatedSeatIds: e.allocatedSeatIds,
          allocatedSeatLabel: e.allocatedSeatLabel,
          isScattered: e.isScattered,
        }),
      ),
    );

    // ── Step 5: 鏈上記錄（失敗不影響抽籤結果）──────────
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
   * 取得活動抽籤結果。
   */
  async getResults(eventId: string): Promise<DrawResultResponseDto> {
    return this.buildDrawResultResponse(eventId);
  }

  /**
   * 取得鏈上證明詳情。
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
   * 使用 keccak256 為每筆報名計算全域排序鍵。
   * sortKey = keccak256(seed, zoneId, entryId)
   * 同區內所有 groupSize 混在一起排序，VRF 決定處理優先順序。
   */
  private computeGlobalSortKeys(
    entries: LotteryEntry[],
    randomSeed: string,
  ): { entry: LotteryEntry; sortKey: string }[] {
    return entries
      .map((entry) => {
        const sortKey = keccak256(
          solidityPacked(
            ['string', 'string', 'string'],
            [randomSeed, entry.zoneId, entry.id],
          ),
        );
        return { entry, sortKey };
      })
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }

  /**
   * 按 zoneId 分組，保持 VRF 排序順序。
   */
  private groupByZone(
    sortedEntries: { entry: LotteryEntry; sortKey: string }[],
  ): Map<string, LotteryEntry[]> {
    const groups = new Map<string, LotteryEntry[]>();
    for (const { entry } of sortedEntries) {
      const list = groups.get(entry.zoneId) ?? [];
      list.push(entry);
      groups.set(entry.zoneId, list);
    }
    return groups;
  }

  /**
   * 單一 zone 的原子化抽籤 + 座位分配。
   *
   * 在一筆 DB 交易中：
   * 1. 鎖定該區所有 AVAILABLE 座位
   * 2. 按 VRF 順序處理每筆報名
   * 3. 先嘗試連號 → 失敗則嘗試散座 → 都不夠則標 LOST
   * 4. 批次更新座位狀態
   */
  private async allocateZone(
    eventId: string,
    zoneId: string,
    entries: LotteryEntry[],
  ): Promise<void> {
    await this.dataSource.transaction(async (manager: EntityManager) => {
      // 鎖定該區所有可用座位
      const availableSeats: Seat[] = await manager
        .createQueryBuilder(Seat, 's')
        .where('s.eventId = :eventId', { eventId })
        .andWhere('s.zoneId = :zoneId', { zoneId })
        .andWhere('s.status = :status', { status: SeatStatus.AVAILABLE })
        .orderBy('s.row', 'ASC')
        .addOrderBy('s.seatNumber', 'ASC')
        .setLock('pessimistic_write_or_fail')
        .setOnLocked('skip_locked')
        .getMany();

      // 在記憶體維護可用座位清單（mutable）
      const remaining = [...availableSeats];
      const seatsToUpdate: Seat[] = [];
      const now = new Date();

      for (const entry of entries) {
        const { groupSize } = entry;

        // 嘗試連號分配
        let allocated = findConsecutiveSeats(remaining, groupSize);
        let scattered = false;

        if (!allocated) {
          // 找不到連號，降級為散座分配
          allocated = pickScatteredSeats(remaining, groupSize);
          scattered = true;
        }

        if (allocated) {
          // 中籤：分配座位
          entry.status = LotteryEntryStatus.WON;
          entry.allocatedSeatIds = allocated.map((s) => s.id);
          entry.allocatedSeatLabel = this.buildSeatLabel(allocated);
          entry.isScattered = scattered;

          // 更新座位狀態
          for (const seat of allocated) {
            seat.status = SeatStatus.ALLOCATED;
            seat.allocatedAt = now;
            seatsToUpdate.push(seat);

            // 從可用清單移除
            const idx = remaining.findIndex((s) => s.id === seat.id);
            if (idx !== -1) remaining.splice(idx, 1);
          }
        } else {
          // 座位不足：未中籤
          entry.status = LotteryEntryStatus.LOST;
          entry.allocatedSeatIds = null;
          entry.allocatedSeatLabel = null;
          entry.isScattered = false;
        }
      }

      // 批次儲存座位更新
      if (seatsToUpdate.length > 0) {
        await manager.save(Seat, seatsToUpdate);
      }
    });
  }

  /**
   * 產生人類可讀的座位標籤。
   * 例如："B 排 / 5-8 號" 或 "B 排 3 號, C 排 1 號"（散座）
   */
  private buildSeatLabel(seats: Seat[]): string {
    if (seats.length === 0) return '';

    // 按 row 分組
    const byRow = new Map<string, number[]>();
    for (const s of seats) {
      const nums = byRow.get(s.row) ?? [];
      nums.push(s.seatNumber);
      byRow.set(s.row, nums);
    }

    const parts: string[] = [];
    for (const [row, nums] of byRow) {
      nums.sort((a, b) => a - b);
      if (nums.length === 1) {
        parts.push(`${row} 排 ${nums[0]} 號`);
      } else {
        parts.push(`${row} 排 ${nums[0]}-${nums[nums.length - 1]} 號`);
      }
    }

    return parts.join(', ');
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
   * 建構完整的抽籤結果回應 DTO。
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
      allocatedSeatIds: e.allocatedSeatIds,
      allocatedSeatLabel: e.allocatedSeatLabel,
      isScattered: e.isScattered,
    }));

    const totalWinners = entries.filter(
      (e) => e.status === LotteryEntryStatus.WON,
    ).length;
    const totalLost = entries.filter(
      (e) => e.status === LotteryEntryStatus.LOST,
    ).length;

    return {
      eventId,
      vrfRequestId: drawResult?.vrfRequestId ?? null,
      randomSeed: drawResult?.randomSeed ?? null,
      drawProofTxHash: drawResult?.drawProofTxHash ?? null,
      drawnAt: drawResult?.drawnAt ?? null,
      totalWinners,
      totalLost,
      entries: entryDtos,
    };
  }
}
