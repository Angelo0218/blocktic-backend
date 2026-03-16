import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { VerifyOtpResponseDto } from './dto/verify-otp-response.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '發送 OTP 驗證碼至手機' })
  @ApiResponse({ status: 200, description: 'OTP 已發送' })
  sendOtp(@Body() dto: SendOtpDto): { message: string } {
    return this.authService.sendOtp(dto);
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '驗證 OTP 並取得 JWT token' })
  @ApiResponse({ status: 200, type: VerifyOtpResponseDto })
  @ApiResponse({ status: 400, description: 'OTP 驗證碼錯誤' })
  async verifyOtp(@Body() dto: VerifyOtpDto): Promise<VerifyOtpResponseDto> {
    return this.authService.verifyOtp(dto);
  }

  @Post('register')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '完成註冊（填寫姓名、暱稱）' })
  @ApiResponse({ status: 200, description: '註冊完成' })
  @ApiResponse({ status: 409, description: '使用者已完成註冊' })
  @HttpCode(HttpStatus.OK)
  async register(@CurrentUser('sub') userId: string, @Body() dto: RegisterDto) {
    return this.authService.register(userId, dto);
  }
}
