import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, Length } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({
    description: '手機號碼',
    example: '0912345678',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^09\d{8}$/, { message: '手機號碼格式錯誤' })
  phone: string;

  @ApiProperty({
    description: 'OTP 驗證碼（6 碼數字）',
    example: '123456',
  })
  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  code: string;
}
