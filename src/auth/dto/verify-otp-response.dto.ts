import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpResponseDto {
  @ApiProperty({ description: 'JWT access token' })
  token: string;

  @ApiProperty({ description: '是否為新用戶（需進入註冊流程）' })
  isNewUser: boolean;

  @ApiProperty({ description: '使用者 UUID' })
  userId: string;
}
