import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { LotteryEntry, LotteryEntryStatus } from './entities/lottery-entry.entity';
import { DrawResult } from './entities/draw-result.entity';
import { RegisterLotteryDto } from './dto/register-lottery.dto';
import {
  DrawResultResponseDto,
  DrawResultEntryDto,
  DrawProofResponseDto,
} from './dto/draw-result.dto';

@Injectable()
export class LotteryService {
  constructor(
    @InjectRepository(LotteryEntry)
    private readonly entryRepo: Repository<LotteryEntry>,
    @InjectRepository(DrawResult)
    private readonly drawResultRepo: Repository<DrawResult>,
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
   *  1. Request randomness from Chainlink VRF (stubbed).
   *  2. Group entries by (zoneId, groupSize) into pools.
   *  3. For each pool, expand the VRF seed via keccak256 to produce a
   *     deterministic per-entry sort key, then sort and select winners.
   *  4. Persist the draw result and update entry statuses.
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

    // --- Step 1: Request Chainlink VRF randomness (stub) ---
    const { vrfRequestId, randomSeed } = await this.requestVrfRandomness();

    // --- Step 2: Group entries into pools by zoneId + groupSize ---
    const pools = this.groupIntoPools(entries);

    // --- Step 3: For each pool, expand seed and sort to pick winners ---
    for (const [_poolKey, poolEntries] of pools) {
      this.selectWinners(poolEntries, randomSeed, _poolKey);
    }

    // --- Step 4: Publish draw proof on-chain (stub) ---
    const drawProofTxHash = await this.publishDrawProof(eventId, randomSeed);

    // Persist draw result
    const drawResult = this.drawResultRepo.create({
      eventId,
      vrfRequestId,
      randomSeed,
      drawProofTxHash,
    });
    await this.drawResultRepo.save(drawResult);

    // Batch-update all entries
    await Promise.all(
      entries.map((e) =>
        this.entryRepo.update(e.id, {
          status: e.status,
          drawProofTxHash,
        }),
      ),
    );

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
   * Stub: Request randomness from Chainlink VRF on Polygon.
   *
   * TODO: Integrate with actual Chainlink VRF v2 coordinator contract.
   * - Call VRFCoordinatorV2.requestRandomWords() via ethers.js
   * - Wait for the VRF callback (fulfillRandomWords) to receive the result
   * - Return the VRF requestId and the resulting random seed
   */
  private async requestVrfRandomness(): Promise<{
    vrfRequestId: string;
    randomSeed: string;
  }> {
    // TODO: Replace with real Chainlink VRF call on Polygon
    const stubSeed = createHash('sha256')
      .update(`vrf-stub-${Date.now()}-${Math.random()}`)
      .digest('hex');

    return {
      vrfRequestId: `vrf-req-stub-${Date.now()}`,
      randomSeed: `0x${stubSeed}`,
    };
  }

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
   * For a pool of entries, use keccak256-based expansion of the VRF seed
   * to produce a deterministic sort key per entry, then mark top entries
   * as winners. Currently selects roughly 50% of each pool as winners.
   *
   * The keccak256 expansion: hash(seed + poolKey + entryId) for each entry,
   * sort ascending by hash, top N are winners.
   */
  private selectWinners(
    entries: LotteryEntry[],
    randomSeed: string,
    poolKey: string,
  ): void {
    // Produce a deterministic sort key per entry via keccak256 expansion
    const sorted = entries
      .map((entry) => {
        const sortKey = this.keccak256Expand(randomSeed, poolKey, entry.id);
        return { entry, sortKey };
      })
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    // Select roughly 50% as winners (configurable per event in production)
    const winnerCount = Math.max(1, Math.ceil(sorted.length * 0.5));

    sorted.forEach(({ entry }, index) => {
      entry.status =
        index < winnerCount
          ? LotteryEntryStatus.WON
          : LotteryEntryStatus.LOST;
    });
  }

  /**
   * keccak256 expansion: deterministic hash of (seed, poolKey, entryId).
   *
   * Uses SHA-256 as a stand-in. In production this should use actual
   * keccak256 (e.g. from ethers.js) to match on-chain verification.
   *
   * TODO: Replace with ethers.keccak256(ethers.solidityPacked(...))
   */
  private keccak256Expand(
    seed: string,
    poolKey: string,
    entryId: string,
  ): string {
    // TODO: Use ethers.keccak256 for on-chain verifiable expansion
    return createHash('sha256')
      .update(`${seed}:${poolKey}:${entryId}`)
      .digest('hex');
  }

  /**
   * Stub: Publish draw proof transaction on Polygon.
   *
   * TODO: Integrate with smart contract to store draw proof on-chain.
   * - Encode (eventId, randomSeed, winnerHashes) and submit via ethers.js
   * - Return the transaction hash
   */
  private async publishDrawProof(
    _eventId: string,
    _randomSeed: string,
  ): Promise<string> {
    // TODO: Replace with actual on-chain transaction via ethers.js on Polygon
    return `0x${'0'.repeat(64)}`;
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
