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

const MOCK_OTP = '123456';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async sendOtp(dto: SendOtpDto): Promise<{ message: string }> {
    this.logger.log(`[Mock OTP] 發送 OTP 至 ${dto.phone}，驗證碼：${MOCK_OTP}`);
    return { message: 'OTP 已發送' };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<VerifyOtpResponseDto> {
    if (dto.code !== MOCK_OTP) {
      throw new BadRequestException('OTP 驗證碼錯誤');
    }

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
