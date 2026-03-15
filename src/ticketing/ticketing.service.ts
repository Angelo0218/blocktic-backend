import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket, TicketStatus } from './entities/ticket.entity';
import { PreauthDto } from './dto/preauth.dto';

@Injectable()
export class TicketingService {
  private readonly logger = new Logger(TicketingService.name);

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
  ) {}

  // ----------------------------------------------------------------
  // ECPay pre-authorization (21-day hold)
  // ----------------------------------------------------------------

  async preauthorize(
    eventId: string,
    dto: PreauthDto,
  ): Promise<{ ticket: Ticket; paymentUrl: string }> {
    const tradeNo = this.generateTradeNo();

    const ticket = this.ticketRepo.create({
      eventId,
      userId: dto.userId,
      status: TicketStatus.PREAUTHORIZED,
      preauthTradeNo: tradeNo,
    });
    await this.ticketRepo.save(ticket);

    // --- STUB: ECPay credit-card pre-auth API ---
    const paymentUrl = await this.ecpayPreauth({
      tradeNo,
      amount: dto.amount,
      returnUrl: dto.returnUrl,
    });

    this.logger.log(
      `Pre-authorized ticket ${ticket.id} with trade ${tradeNo}`,
    );

    return { ticket, paymentUrl };
  }

  // ----------------------------------------------------------------
  // Capture payment after lottery win
  // ----------------------------------------------------------------

  async capturePayment(ticketId: string): Promise<Ticket> {
    const ticket = await this.findOneOrFail(ticketId);

    if (ticket.status !== TicketStatus.PREAUTHORIZED) {
      throw new BadRequestException(
        `Ticket ${ticketId} is not in preauthorized state (current: ${ticket.status})`,
      );
    }

    // --- STUB: ECPay capture (close the pre-auth) ---
    await this.ecpayCapture(ticket.preauthTradeNo);

    ticket.status = TicketStatus.PAID;
    ticket.paidAt = new Date();
    await this.ticketRepo.save(ticket);

    this.logger.log(`Captured payment for ticket ${ticketId}`);
    return ticket;
  }

  // ----------------------------------------------------------------
  // Mint SBT (Soulbound Token) ticket on Polygon
  // Only the platform (contract owner) can execute mint.
  // SBTs are non-transferable by users.
  // ----------------------------------------------------------------

  async mintTicket(ticketId: string): Promise<Ticket> {
    const ticket = await this.findOneOrFail(ticketId);

    if (ticket.status !== TicketStatus.PAID) {
      throw new BadRequestException(
        `Ticket ${ticketId} must be paid before minting (current: ${ticket.status})`,
      );
    }

    // --- STUB: Polygon SBT mint (only platform/contract owner can call) ---
    const { sbtTokenId, txHash } = await this.mintSbt(
      ticket.eventId,
      ticket.userId,
    );

    ticket.status = TicketStatus.MINTED;
    ticket.sbtTokenId = sbtTokenId;
    ticket.txHash = txHash;
    ticket.mintedAt = new Date();
    await this.ticketRepo.save(ticket);

    this.logger.log(
      `Minted SBT ticket ${ticketId} as token ${sbtTokenId} (tx: ${txHash})`,
    );
    return ticket;
  }

  // ----------------------------------------------------------------
  // Refund: void pre-auth and return seat to waitlist pool
  // ----------------------------------------------------------------

  async refundTicket(ticketId: string): Promise<Ticket> {
    const ticket = await this.findOneOrFail(ticketId);

    if (
      ticket.status !== TicketStatus.PREAUTHORIZED &&
      ticket.status !== TicketStatus.PAID
    ) {
      throw new BadRequestException(
        `Ticket ${ticketId} cannot be refunded (current: ${ticket.status})`,
      );
    }

    // --- STUB: ECPay void / refund ---
    await this.ecpayVoid(ticket.preauthTradeNo);

    // --- STUB: return seat to waitlist pool ---
    if (ticket.seatId) {
      await this.returnSeatToWaitlistPool(ticket.eventId, ticket.seatId);
    }

    // --- STUB: burn SBT if already minted (only platform/contract owner can burn) ---
    // Refund = platform burns the SBT + seat goes back to waitlist pool
    if (ticket.sbtTokenId) {
      await this.burnSbt(ticket.sbtTokenId);
    }

    ticket.status = TicketStatus.REFUNDED;
    ticket.refundedAt = new Date();
    await this.ticketRepo.save(ticket);

    this.logger.log(`Refunded ticket ${ticketId}`);
    return ticket;
  }

  // ----------------------------------------------------------------
  // Queries
  // ----------------------------------------------------------------

  async findByUser(userId: string): Promise<Ticket[]> {
    return this.ticketRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(ticketId: string): Promise<Ticket> {
    return this.findOneOrFail(ticketId);
  }

  // ----------------------------------------------------------------
  // Private helpers & stubs
  // ----------------------------------------------------------------

  private async findOneOrFail(ticketId: string): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }
    return ticket;
  }

  private generateTradeNo(): string {
    const now = new Date();
    const ts = now.toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `BT${ts}${rand}`;
  }

  // ---------- ECPay stubs ----------

  private async ecpayPreauth(params: {
    tradeNo: string;
    amount: number;
    returnUrl: string;
  }): Promise<string> {
    // TODO: integrate with ECPay credit-card pre-auth API
    this.logger.warn(`[STUB] ECPay preauth: ${JSON.stringify(params)}`);
    return `https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5?trade=${params.tradeNo}`;
  }

  private async ecpayCapture(tradeNo: string | null): Promise<void> {
    // TODO: integrate with ECPay capture / close-trade API
    this.logger.warn(`[STUB] ECPay capture trade: ${tradeNo}`);
  }

  private async ecpayVoid(tradeNo: string | null): Promise<void> {
    // TODO: integrate with ECPay void / refund API
    this.logger.warn(`[STUB] ECPay void trade: ${tradeNo}`);
  }

  // ---------- Blockchain stubs (SBT - Soulbound Token) ----------
  // Only the platform (contract owner) can mint/burn SBTs.
  // SBTs are non-transferable by users.

  private async mintSbt(
    eventId: string,
    userId: string,
  ): Promise<{ sbtTokenId: string; txHash: string }> {
    // TODO: call Polygon contract to mint SBT ticket (platform-only operation)
    this.logger.warn(
      `[STUB] Minting SBT for event=${eventId} user=${userId}`,
    );
    const sbtTokenId = Math.floor(Math.random() * 1_000_000).toString();
    const txHash = `0x${Buffer.from(Math.random().toString()).toString('hex').slice(0, 64)}`;
    return { sbtTokenId, txHash };
  }

  private async burnSbt(sbtTokenId: string): Promise<void> {
    // TODO: call Polygon contract to burn SBT ticket (platform-only operation)
    this.logger.warn(`[STUB] Burning SBT token ${sbtTokenId}`);
  }

  // ---------- Waitlist pool stub ----------

  private async returnSeatToWaitlistPool(
    eventId: string,
    seatId: string,
  ): Promise<void> {
    // TODO: re-enqueue seat into the waitlist / seat-allocation pool
    this.logger.warn(
      `[STUB] Returning seat ${seatId} to waitlist pool for event ${eventId}`,
    );
  }
}
