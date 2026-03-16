import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({
    description: '手機號碼（台灣格式 09xxxxxxxx）',
    example: '0912345678',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^09\d{8}$/, {
    message: '手機號碼格式錯誤，需為 09 開頭的 10 碼數字',
  })
  phone: string;
}
