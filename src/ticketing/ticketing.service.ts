import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { Ticket, TicketStatus } from './entities/ticket.entity';
import { PreauthDto } from './dto/preauth.dto';
import { BlockchainService } from '../blockchain/blockchain.service';
import { SeatAllocationService } from '../seat-allocation/seat-allocation.service';
import { IdentityService } from '../identity/identity.service';
import { generateCheckMacValue } from './ecpay.util';
import { fetchWithTimeout } from '../common/utils/fetch-with-timeout';

/** 票券 SBT token ID 起始值（1000+，1–999 保留給 KYC） */
const TICKET_TOKEN_ID_BASE = 1000;

@Injectable()
export class TicketingService {
  private readonly logger = new Logger(TicketingService.name);

  private readonly ecpayMerchantId: string;
  private readonly ecpayHashKey: string;
  private readonly ecpayHashIV: string;
  private readonly ecpayReturnUrl: string;
  private readonly ecpayApiUrl: string;

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    private readonly config: ConfigService,
    private readonly blockchainService: BlockchainService,
    private readonly seatAllocationService: SeatAllocationService,
    private readonly identityService: IdentityService,
  ) {
    this.ecpayMerchantId = this.config.getOrThrow<string>('ECPAY_MERCHANT_ID');
    this.ecpayHashKey = this.config.getOrThrow<string>('ECPAY_HASH_KEY');
    this.ecpayHashIV = this.config.getOrThrow<string>('ECPAY_HASH_IV');
    this.ecpayReturnUrl = this.config.getOrThrow<string>('ECPAY_RETURN_URL');

    // 測試環境用 stage，正式環境用 payment
    const isProd = this.config.get('NODE_ENV') === 'production';
    this.ecpayApiUrl = isProd
      ? 'https://payment.ecpay.com.tw'
      : 'https://payment-stage.ecpay.com.tw';
  }

  // ----------------------------------------------------------------
  // ECPay pre-authorization (21-day hold)
  // ----------------------------------------------------------------

  async preauthorize(
    eventId: string,
    dto: PreauthDto,
  ): Promise<{ ticket: Ticket; paymentFormData: Record<string, string> }> {
    const tradeNo = this.generateTradeNo();

    const ticket = this.ticketRepo.create({
      eventId,
      userId: dto.userId,
      amount: dto.amount,
      status: TicketStatus.PREAUTHORIZED,
      preauthTradeNo: tradeNo,
    });
    await this.ticketRepo.save(ticket);

    const paymentFormData = this.buildEcpayFormData({
      tradeNo,
      amount: dto.amount,
      returnUrl: dto.returnUrl,
    });

    this.logger.log(
      `Pre-authorized ticket ${ticket.id} with trade ${tradeNo}`,
    );

    return { ticket, paymentFormData };
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

    await this.ecpayDoAction(ticket.preauthTradeNo!, 'C', ticket.amount);

    ticket.status = TicketStatus.PAID;
    ticket.paidAt = new Date();
    await this.ticketRepo.save(ticket);

    this.logger.log(`Captured payment for ticket ${ticketId}`);
    return ticket;
  }

  // ----------------------------------------------------------------
  // Mint SBT (Soulbound Token) ticket on Polygon
  // ----------------------------------------------------------------

  async mintTicket(ticketId: string): Promise<Ticket> {
    const ticket = await this.findOneOrFail(ticketId);

    if (ticket.status !== TicketStatus.PAID) {
      throw new BadRequestException(
        `Ticket ${ticketId} must be paid before minting (current: ${ticket.status})`,
      );
    }

    // 查詢使用者的 AA 錢包地址
    const kycStatus = await this.identityService.getKycStatus(ticket.userId);
    if (!kycStatus.aaWalletAddress) {
      throw new BadRequestException(
        `User ${ticket.userId} does not have an AA wallet. KYC must be completed first.`,
      );
    }

    // 以 ticket UUID 的 hash 產生唯一 token ID，避免碰撞
    const sbtTokenId = this.deriveTokenId(ticket.id);

    const txHash = await this.blockchainService.mintTicketSbt(
      kycStatus.aaWalletAddress,
      sbtTokenId,
    );

    ticket.status = TicketStatus.MINTED;
    ticket.sbtTokenId = sbtTokenId.toString();
    ticket.aaWalletAddress = kycStatus.aaWalletAddress;
    ticket.txHash = txHash;
    ticket.mintedAt = new Date();
    await this.ticketRepo.save(ticket);

    this.logger.log(
      `Minted SBT ticket ${ticketId} as token ${sbtTokenId} (tx: ${txHash})`,
    );
    return ticket;
  }

  // ----------------------------------------------------------------
  // Refund: void pre-auth, burn SBT, return seat
  // ----------------------------------------------------------------

  async refundTicket(ticketId: string): Promise<Ticket> {
    const ticket = await this.findOneOrFail(ticketId);

    const refundable: TicketStatus[] = [
      TicketStatus.PREAUTHORIZED,
      TicketStatus.PAID,
      TicketStatus.MINTED,
    ];
    if (!refundable.includes(ticket.status)) {
      throw new BadRequestException(
        `Ticket ${ticketId} cannot be refunded (current: ${ticket.status})`,
      );
    }

    // ECPay 退款 / 取消預授權
    if (ticket.preauthTradeNo) {
      await this.ecpayDoAction(ticket.preauthTradeNo, 'N', ticket.amount);
    }

    // 歸還座位
    if (ticket.seatId) {
      await this.seatAllocationService.releaseSeat(ticket.seatId);
    }

    // 銷毀 SBT（若已鑄造）
    if (ticket.sbtTokenId && ticket.aaWalletAddress) {
      try {
        await this.blockchainService.burnTicketSbt(
          ticket.aaWalletAddress,
          parseInt(ticket.sbtTokenId, 10),
        );
      } catch (error) {
        this.logger.error(`SBT 銷毀失敗 ticket=${ticketId}，需人工處理`, error);
      }
    }

    ticket.status = TicketStatus.REFUNDED;
    ticket.refundedAt = new Date();
    await this.ticketRepo.save(ticket);

    this.logger.log(`Refunded ticket ${ticketId}`);
    return ticket;
  }

  // ----------------------------------------------------------------
  // ECPay callback（綠界伺服器回呼）
  // ----------------------------------------------------------------

  async handleEcpayCallback(body: Record<string, string>): Promise<string> {
    // 驗證 CheckMacValue
    const receivedMac = body['CheckMacValue'];
    const paramsWithoutMac = { ...body };
    delete paramsWithoutMac['CheckMacValue'];

    const expectedMac = generateCheckMacValue(
      paramsWithoutMac,
      this.ecpayHashKey,
      this.ecpayHashIV,
    );

    if (receivedMac !== expectedMac) {
      this.logger.error('ECPay callback CheckMacValue 驗證失敗');
      return '0|CheckMacValue Error';
    }

    const tradeNo = body['MerchantTradeNo'];
    const rtnCode = body['RtnCode'];

    const ticket = await this.ticketRepo.findOne({
      where: { preauthTradeNo: tradeNo },
    });

    if (!ticket) {
      this.logger.error(`ECPay callback: 找不到 trade ${tradeNo}`);
      return '0|Order Not Found';
    }

    // RtnCode=1 表示交易成功
    if (rtnCode === '1') {
      this.logger.log(`ECPay callback 成功 — trade=${tradeNo}`);
    } else {
      this.logger.warn(`ECPay callback 失敗 — trade=${tradeNo}, RtnCode=${rtnCode}`);
    }

    // 綠界要求回傳 "1|OK"
    return '1|OK';
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
  // Private helpers
  // ----------------------------------------------------------------

  private async findOneOrFail(ticketId: string): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }
    return ticket;
  }

  /**
   * 產生 ECPay MerchantTradeNo（最長 20 字元）。
   * 格式：BT + 12 位時間戳 + 6 位隨機 = 20 字元。
   */
  private generateTradeNo(): string {
    const now = new Date();
    const ts = now.toISOString().replace(/[-T:.Z]/g, '').slice(2, 14); // 12 位（去年份前兩碼）
    const rand = createHash('sha256').update(`${Date.now()}-${Math.random()}`).digest('hex').substring(0, 6).toUpperCase();
    return `BT${ts}${rand}`;
  }

  /**
   * 以 ticket UUID 推導唯一 SBT token ID（1000+）。
   * 取 UUID 的 SHA-256 前 6 bytes 作為數值，加上 base 避開 KYC 範圍。
   */
  private deriveTokenId(ticketId: string): number {
    const hash = createHash('sha256').update(ticketId).digest();
    // 取前 4 bytes 作為 uint32（最大 ~4.2B），加上 base
    const num = hash.readUInt32BE(0);
    return TICKET_TOKEN_ID_BASE + (num % 1_000_000_000);
  }

  // ----------------------------------------------------------------
  // ECPay API 整合
  // ----------------------------------------------------------------

  /**
   * 建立 ECPay AioCheckOut 表單參數（前端以 form POST 送出）。
   */
  private buildEcpayFormData(params: {
    tradeNo: string;
    amount: number;
    returnUrl: string;
  }): Record<string, string> {
    const now = new Date();
    const tradeDate = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const orderParams: Record<string, string | number> = {
      MerchantID: this.ecpayMerchantId,
      MerchantTradeNo: params.tradeNo,
      MerchantTradeDate: tradeDate,
      PaymentType: 'aio',
      TotalAmount: params.amount,
      TradeDesc: 'BlockTic Ticket Preauthorization',
      ItemName: 'BlockTic 票券預授權',
      ReturnURL: this.ecpayReturnUrl,
      ClientBackURL: params.returnUrl,
      ChoosePayment: 'Credit',
      EncryptType: 1,
    };

    orderParams['CheckMacValue'] = generateCheckMacValue(
      orderParams,
      this.ecpayHashKey,
      this.ecpayHashIV,
    );

    // 轉為全 string（前端直接用這些欄位建立 form POST 到綠界）
    const formData: Record<string, string> = {};
    for (const [k, v] of Object.entries(orderParams)) {
      formData[k] = String(v);
    }
    formData['_action'] = `${this.ecpayApiUrl}/Cashier/AioCheckOut/V5`;
    return formData;
  }

  /**
   * 綠界 DoAction（請款/退款/取消）。
   */
  private async ecpayDoAction(
    tradeNo: string,
    action: 'C' | 'R' | 'E' | 'N',
    amount: number,
  ): Promise<void> {
    const params: Record<string, string | number> = {
      MerchantID: this.ecpayMerchantId,
      MerchantTradeNo: tradeNo,
      TradeNo: tradeNo,
      Action: action,
      TotalAmount: amount,
    };

    params['CheckMacValue'] = generateCheckMacValue(
      params,
      this.ecpayHashKey,
      this.ecpayHashIV,
    );

    const response = await fetchWithTimeout(
      `${this.ecpayApiUrl}/CreditDetail/DoAction`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(
          Object.fromEntries(
            Object.entries(params).map(([k, v]) => [k, String(v)]),
          ),
        ),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`ECPay DoAction 失敗 — action=${action}, trade=${tradeNo}, body=${body}`);
      throw new InternalServerErrorException(`ECPay ${action} operation failed.`);
    }

    const result = await response.text();
    this.logger.log(`ECPay DoAction 完成 — action=${action}, trade=${tradeNo}, result=${result}`);
  }
}
