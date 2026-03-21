import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import Redis from 'ioredis';

import { GateLog, VerificationMode, VerificationResult } from './entities/gate-log.entity';
import { Ticket, TicketStatus } from '../ticketing/entities/ticket.entity';
import { Person } from '../identity/entities/person.entity';
import { BlockchainService } from '../blockchain/blockchain.service';
import { fetchWithTimeout } from '../common/utils/fetch-with-timeout';

interface QrPayload {
  sub: string; // ticketId
  nonce: string;
  iat: number;
}

export interface VerifyResult {
  success: boolean;
  ticketId: string;
  mode: VerificationMode;
  result: VerificationResult;
  faceScore?: number;
  message: string;
}

@Injectable()
export class GateVerificationService {
  private readonly logger = new Logger(GateVerificationService.name);
  private readonly redis: Redis;
  private readonly QR_TTL_SECONDS = 60;
  private readonly NONCE_KEY_PREFIX = 'gate:nonce:';
  private readonly comprefaceUrl: string;
  private readonly recognizeApiKey: string;
  private readonly faceMatchThreshold: number;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(GateLog)
    private readonly gateLogRepo: Repository<GateLog>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(Person)
    private readonly personRepo: Repository<Person>,
    private readonly blockchainService: BlockchainService,
  ) {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
    });

    this.comprefaceUrl = this.configService.get<string>('COMPREFACE_URL', 'http://compreface-api:8000');
    this.recognizeApiKey = this.configService.get<string>('COMPREFACE_RECOGNIZE_API_KEY', '');
    this.faceMatchThreshold = this.configService.get<number>('FACE_MATCH_THRESHOLD', 0.85);
  }

  // ── Generate Dynamic QR ──────────────────────────────────────────────

  async generateDynamicQr(ticketId: string): Promise<{ qrToken: string; expiresIn: number }> {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) {
      throw new BadRequestException('Ticket not found');
    }
    if (ticket.status === TicketStatus.USED) {
      throw new ConflictException('Ticket has already been used');
    }
    if (ticket.status === TicketStatus.REFUNDED) {
      throw new BadRequestException('Ticket has been refunded');
    }

    const nonce = randomBytes(16).toString('hex');

    const qrToken = this.jwtService.sign(
      { sub: ticketId, nonce },
      { expiresIn: this.QR_TTL_SECONDS, algorithm: 'RS256' },
    );

    return { qrToken, expiresIn: this.QR_TTL_SECONDS };
  }

  // ── Verify Entry ─────────────────────────────────────────────────────

  async verifyEntry(
    qrToken: string,
    gateId: string,
    staffId: string,
    facePhoto?: string,
  ): Promise<VerifyResult> {
    // 1. Parse and verify JWT signature
    let payload: QrPayload;
    try {
      payload = this.jwtService.verify<QrPayload>(qrToken, { algorithms: ['RS256'] });
    } catch {
      throw new UnauthorizedException('Invalid or expired QR token');
    }

    const { sub: ticketId, nonce, iat } = payload;

    // 2. Check timestamp freshness (< 60s)
    const now = Math.floor(Date.now() / 1000);
    if (now - iat > this.QR_TTL_SECONDS) {
      throw new UnauthorizedException('QR code has expired');
    }

    // 3. Replay prevention via Redis SET NX
    const nonceKey = `${this.NONCE_KEY_PREFIX}${nonce}`;
    const isNew = await this.redis.set(nonceKey, '1', 'EX', this.QR_TTL_SECONDS * 2, 'NX');
    if (!isNew) {
      throw new ConflictException('QR code has already been scanned (replay detected)');
    }

    // 4. Check ticket status in DB
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) {
      await this.saveLog(ticketId, ticketId, gateId, VerificationMode.NORMAL, VerificationResult.FAILED, null, staffId);
      throw new BadRequestException('Ticket not found');
    }
    if (ticket.status === TicketStatus.USED) {
      await this.saveLog(ticket.eventId, ticketId, gateId, VerificationMode.NORMAL, VerificationResult.FAILED, null, staffId);
      throw new ConflictException('Ticket has already been used');
    }
    if (ticket.status !== TicketStatus.MINTED && ticket.status !== TicketStatus.PAID) {
      await this.saveLog(ticket.eventId, ticketId, gateId, VerificationMode.NORMAL, VerificationResult.FAILED, null, staffId);
      throw new BadRequestException(`Ticket status "${ticket.status}" is not valid for entry`);
    }

    // 5. Check on-chain SBT ownership
    const ownershipValid = await this.checkOnChainOwnership(ticket.sbtTokenId, ticket.aaWalletAddress);
    if (!ownershipValid) {
      await this.saveLog(ticket.eventId, ticketId, gateId, VerificationMode.NORMAL, VerificationResult.FAILED, null, staffId);
      throw new UnauthorizedException('On-chain ticket ownership verification failed');
    }

    // 6. Determine mode and perform face comparison if needed
    let mode = VerificationMode.NORMAL;
    let faceScore: number | null = null;

    if (facePhoto) {
      mode = VerificationMode.STRONG;
      faceScore = await this.compareFace(ticket.userId, facePhoto);

      if (faceScore < this.faceMatchThreshold) {
        await this.saveLog(ticket.eventId, ticketId, gateId, mode, VerificationResult.FAILED, faceScore, staffId);
        throw new UnauthorizedException(`Face match score ${faceScore.toFixed(2)} below threshold`);
      }
    }

    // 7. Atomically mark ticket as used (conditional update prevents double-entry)
    const updateResult = await this.ticketRepo
      .createQueryBuilder()
      .update()
      .set({ status: TicketStatus.USED })
      .where('id = :ticketId', { ticketId })
      .andWhere('status IN (:...validStatuses)', {
        validStatuses: [TicketStatus.PAID, TicketStatus.MINTED],
      })
      .execute();

    if (updateResult.affected === 0) {
      await this.saveLog(ticket.eventId, ticketId, gateId, mode, VerificationResult.FAILED, faceScore, staffId);
      throw new ConflictException('Ticket was already consumed by a concurrent scan');
    }

    // 8. Log success
    await this.saveLog(ticket.eventId, ticketId, gateId, mode, VerificationResult.SUCCESS, faceScore, staffId);

    return {
      success: true,
      ticketId,
      mode,
      result: VerificationResult.SUCCESS,
      faceScore: faceScore ?? undefined,
      message: 'Entry verified successfully',
    };
  }

  // ── Fallback Verification ────────────────────────────────────────────

  async fallbackVerify(
    governmentIdNumber: string,
    eventId: string,
    gateId: string,
    staffId: string,
  ): Promise<VerifyResult> {
    // Hash the government ID to match against personIdHash
    const idHash = createHash('sha256').update(governmentIdNumber).digest('hex');

    const person = await this.personRepo.findOne({ where: { personIdHash: idHash } });
    if (!person) {
      throw new BadRequestException('No person found with the provided government ID');
    }

    // Find a valid ticket for this person and event
    const ticket = await this.ticketRepo.findOne({
      where: {
        eventId,
        userId: person.id,
        status: TicketStatus.MINTED,
      },
    });

    if (!ticket) {
      // Also try PAID status
      const paidTicket = await this.ticketRepo.findOne({
        where: {
          eventId,
          userId: person.id,
          status: TicketStatus.PAID,
        },
      });

      if (!paidTicket) {
        await this.saveLog(eventId, 'unknown', gateId, VerificationMode.FALLBACK, VerificationResult.FAILED, null, staffId);
        throw new BadRequestException('No valid ticket found for this person and event');
      }

      // 條件式 UPDATE 防止並發雙重入場
      const paidResult = await this.ticketRepo
        .createQueryBuilder()
        .update()
        .set({ status: TicketStatus.USED })
        .where('id = :id', { id: paidTicket.id })
        .andWhere('status IN (:...valid)', { valid: [TicketStatus.PAID, TicketStatus.MINTED] })
        .execute();
      if (paidResult.affected === 0) {
        await this.saveLog(eventId, paidTicket.id, gateId, VerificationMode.FALLBACK, VerificationResult.FAILED, null, staffId);
        throw new ConflictException('Ticket was already consumed by a concurrent scan');
      }
      await this.saveLog(eventId, paidTicket.id, gateId, VerificationMode.FALLBACK, VerificationResult.FALLBACK, null, staffId);

      return {
        success: true,
        ticketId: paidTicket.id,
        mode: VerificationMode.FALLBACK,
        result: VerificationResult.FALLBACK,
        message: 'Fallback verification succeeded via government ID',
      };
    }

    // 條件式 UPDATE 防止並發雙重入場
    const mintedResult = await this.ticketRepo
      .createQueryBuilder()
      .update()
      .set({ status: TicketStatus.USED })
      .where('id = :id', { id: ticket.id })
      .andWhere('status IN (:...valid)', { valid: [TicketStatus.PAID, TicketStatus.MINTED] })
      .execute();
    if (mintedResult.affected === 0) {
      await this.saveLog(eventId, ticket.id, gateId, VerificationMode.FALLBACK, VerificationResult.FAILED, null, staffId);
      throw new ConflictException('Ticket was already consumed by a concurrent scan');
    }
    await this.saveLog(eventId, ticket.id, gateId, VerificationMode.FALLBACK, VerificationResult.FALLBACK, null, staffId);

    return {
      success: true,
      ticketId: ticket.id,
      mode: VerificationMode.FALLBACK,
      result: VerificationResult.FALLBACK,
      message: 'Fallback verification succeeded via government ID',
    };
  }

  // ── Entry Statistics ─────────────────────────────────────────────────

  async getEntryStats(eventId: string) {
    const total = await this.gateLogRepo.count({ where: { eventId } });

    const success = await this.gateLogRepo.count({
      where: { eventId, result: VerificationResult.SUCCESS },
    });

    const failed = await this.gateLogRepo.count({
      where: { eventId, result: VerificationResult.FAILED },
    });

    const fallback = await this.gateLogRepo.count({
      where: { eventId, result: VerificationResult.FALLBACK },
    });

    const byMode = {
      strong: await this.gateLogRepo.count({ where: { eventId, verificationMode: VerificationMode.STRONG } }),
      normal: await this.gateLogRepo.count({ where: { eventId, verificationMode: VerificationMode.NORMAL } }),
      offline: await this.gateLogRepo.count({ where: { eventId, verificationMode: VerificationMode.OFFLINE } }),
      fallback: await this.gateLogRepo.count({ where: { eventId, verificationMode: VerificationMode.FALLBACK } }),
    };

    return { eventId, total, success, failed, fallback, byMode };
  }

  // ── Private Helpers ──────────────────────────────────────────────────

  private async saveLog(
    eventId: string,
    ticketId: string,
    gateId: string,
    verificationMode: VerificationMode,
    result: VerificationResult,
    faceScore: number | null,
    staffId: string,
  ): Promise<GateLog> {
    const log = this.gateLogRepo.create({
      eventId,
      ticketId,
      gateId,
      verificationMode,
      result,
      faceScore,
      staffId,
    });
    return this.gateLogRepo.save(log);
  }

  /**
   * 驗證鏈上 SBT 持有狀態 — 呼叫 BlockTicSBT.balanceOf()。
   *
   * SBT 不可轉讓，因此持有者一定是原始接收者，驗證更可靠。
   * 若 ticket 尚未鑄造 SBT（status=PAID），跳過鏈上驗證。
   */
  private async checkOnChainOwnership(
    tokenId: string | null,
    walletAddress: string | null,
  ): Promise<boolean> {
    if (!tokenId || !walletAddress) {
      this.logger.warn('Ticket 無 SBT tokenId 或 walletAddress，跳過鏈上驗證');
      return true;
    }

    try {
      return await this.blockchainService.verifySbtOwnership(
        walletAddress,
        parseInt(tokenId, 10),
      );
    } catch (error) {
      this.logger.error(`鏈上 SBT 驗證失敗 — tokenId=${tokenId}`, error);
      // 鏈上查詢失敗時不阻擋入場，記錄警告
      return true;
    }
  }

  /**
   * 入場人臉比對 — 透過 CompreFace Recognition API 比對現場照片與已註冊人臉。
   *
   * 以 Person.faceEmbeddingRef（subject ID）為基準，
   * 將現場拍攝的照片送至 CompreFace 辨識，比對相似度。
   */
  private async compareFace(userId: string, facePhotoBase64: string): Promise<number> {
    // 取得使用者的 faceEmbeddingRef
    const person = await this.personRepo.findOne({ where: { id: userId } });
    if (!person?.faceEmbeddingRef) {
      this.logger.warn(`使用者 ${userId} 無人臉嵌入資料，STRONG 模式下拒絕入場`);
      return 0; // STRONG 模式需有嵌入資料才能比對，回傳 0 觸發拒絕
    }

    // 去除 data URL prefix
    const base64 = facePhotoBase64.includes(',')
      ? facePhotoBase64.split(',')[1]
      : facePhotoBase64;

    const imageBuffer = Buffer.from(base64, 'base64');

    const formData = new FormData();
    formData.append('file', new Blob([imageBuffer]), 'gate-face.jpg');

    const response = await fetchWithTimeout(
      `${this.comprefaceUrl}/api/v1/recognition/recognize`,
      {
        method: 'POST',
        headers: { 'x-api-key': this.recognizeApiKey },
        body: formData,
      },
    );

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`CompreFace 入場人臉辨識失敗 — status=${response.status}, body=${body}`);
      throw new InternalServerErrorException('Face recognition service unavailable.');
    }

    const data = await response.json() as {
      result: Array<{ subjects: Array<{ subject: string; similarity: number }> }>;
    };

    // 找到與此使用者 subject 匹配的結果
    const subjects = data.result?.[0]?.subjects ?? [];
    const match = subjects.find((s) => s.subject === person.faceEmbeddingRef);

    if (!match) {
      this.logger.warn(`入場人臉比對：未匹配到 subject=${person.faceEmbeddingRef}`);
      return 0;
    }

    this.logger.log(
      `入場人臉比對 — subject=${match.subject}, similarity=${match.similarity.toFixed(3)}`,
    );
    return match.similarity;
  }
}
