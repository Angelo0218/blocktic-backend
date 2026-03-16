import {
  Injectable,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User } from './entities/user.entity';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { VerifyOtpResponseDto } from './dto/verify-otp-response.dto';
import { RegisterDto } from './dto/register.dto';

/** Mock OTP 驗證碼（demo 模式固定值） */
const MOCK_OTP = '123456';
/** 每支手機號碼最多嘗試驗證次數 */
const MAX_OTP_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  /** 記錄已發送 OTP 的手機號碼及嘗試次數（demo 用，正式環境改用 Redis） */
  private readonly otpStore = new Map<
    string,
    { attempts: number; expiresAt: number }
  >();

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * 發送 OTP（mock 模式：不實際發送，固定為 123456）
   */
  sendOtp(dto: SendOtpDto): { message: string } {
    this.logger.debug(`[Mock OTP] 發送 OTP 至 ${dto.phone}`);
    this.otpStore.set(dto.phone, {
      attempts: 0,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
    return { message: 'OTP 已發送' };
  }

  /**
   * 驗證 OTP 並回傳 JWT。若用戶不存在則自動建立（isNewUser = true）。
   */
  async verifyOtp(dto: VerifyOtpDto): Promise<VerifyOtpResponseDto> {
    const record = this.otpStore.get(dto.phone);
    if (!record || record.expiresAt < Date.now()) {
      this.otpStore.delete(dto.phone);
      throw new BadRequestException('請先發送 OTP');
    }

    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      this.otpStore.delete(dto.phone);
      throw new BadRequestException('驗證次數過多，請重新發送 OTP');
    }

    record.attempts++;

    if (dto.code !== MOCK_OTP) {
      throw new BadRequestException('OTP 驗證碼錯誤');
    }

    // 驗證成功，清除記錄
    this.otpStore.delete(dto.phone);

    let user = await this.userRepo.findOne({ where: { phone: dto.phone } });
    const isNewUser = !user;

    if (!user) {
      user = this.userRepo.create({ phone: dto.phone });
      user = await this.userRepo.save(user);
    }

    const payload = { sub: user.id, role: user.role };
    const token = this.jwtService.sign(payload);

    return { token, isNewUser, userId: user.id };
  }

  /**
   * 完成註冊（填入姓名、暱稱）
   */
  async register(userId: string, dto: RegisterDto): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('使用者不存在');
    }
    if (user.name) {
      throw new ConflictException('使用者已完成註冊');
    }

    user.name = dto.name;
    user.nickname = dto.nickname;
    return this.userRepo.save(user);
  }
}
