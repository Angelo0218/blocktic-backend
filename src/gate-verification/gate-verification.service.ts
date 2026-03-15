import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
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

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(GateLog)
    private readonly gateLogRepo: Repository<GateLog>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(Person)
    private readonly personRepo: Repository<Person>,
  ) {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
    });
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

    // 5. Check on-chain SBT (Soulbound Token) ownership (placeholder)
    const ownershipValid = await this.checkOnChainOwnership(ticket.sbtTokenId, ticket.userId);
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

      const threshold = this.configService.get<number>('FACE_MATCH_THRESHOLD', 0.8);
      if (faceScore < threshold) {
        await this.saveLog(ticket.eventId, ticketId, gateId, mode, VerificationResult.FAILED, faceScore, staffId);
        throw new UnauthorizedException(`Face match score ${faceScore.toFixed(2)} below threshold`);
      }
    }

    // 7. Mark ticket as used
    await this.ticketRepo.update(ticketId, { status: TicketStatus.USED });

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

      await this.ticketRepo.update(paidTicket.id, { status: TicketStatus.USED });
      await this.saveLog(eventId, paidTicket.id, gateId, VerificationMode.FALLBACK, VerificationResult.FALLBACK, null, staffId);

      return {
        success: true,
        ticketId: paidTicket.id,
        mode: VerificationMode.FALLBACK,
        result: VerificationResult.FALLBACK,
        message: 'Fallback verification succeeded via government ID',
      };
    }

    await this.ticketRepo.update(ticket.id, { status: TicketStatus.USED });
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
   * Placeholder: check SBT (Soulbound Token) ownership on-chain.
   * In production this would call an RPC provider (e.g. ethers.js) to verify
   * BlockTicSBT.balanceOf(userId) > 0 on the ticket contract.
   * Since SBTs cannot be transferred, ownership check is even more reliable
   * than fungible/semi-fungible tokens — the holder is always the original recipient.
   */
  private async checkOnChainOwnership(
    tokenId: string | null,
    _userId: string,
  ): Promise<boolean> {
    if (!tokenId) {
      this.logger.warn('No tokenId on ticket, skipping on-chain check');
      return true;
    }
    // TODO: implement actual on-chain BlockTicSBT.balanceOf check
    return true;
  }

  /**
   * Placeholder: compare face photo against stored embedding via CompreFace.
   * Returns a similarity score between 0 and 1.
   */
  private async compareFace(_userId: string, _facePhotoBase64: string): Promise<number> {
    // TODO: integrate with CompreFace API
    // 1. Retrieve faceEmbeddingRef from Person entity
    // 2. Send facePhotoBase64 to CompreFace /api/v1/recognition/recognize
    // 3. Return similarity score
    this.logger.warn('Face comparison is using stub implementation');
    return 0.95;
  }
}
