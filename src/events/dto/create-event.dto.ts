import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsDateString,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  MaxLength,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VerificationMode } from '../entities/event.entity';
import { CreateZoneDto } from './create-zone.dto';

export class CreateEventDto {
  @ApiProperty({ description: '活動名稱', example: '2026 五月天演唱會' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ description: '活動說明' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '封面圖 URL' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImage?: string;

  @ApiProperty({
    description: '開演時間',
    example: '2026-05-01T19:00:00+08:00',
  })
  @IsDateString()
  startTime: string;

  @ApiProperty({
    description: '結束時間',
    example: '2026-05-01T22:00:00+08:00',
  })
  @IsDateString()
  endTime: string;

  @ApiProperty({
    description: '報名開始',
    example: '2026-04-01T00:00:00+08:00',
  })
  @IsDateString()
  registrationStart: string;

  @ApiProperty({
    description: '報名截止',
    example: '2026-04-15T23:59:59+08:00',
  })
  @IsDateString()
  registrationEnd: string;

  @ApiPropertyOptional({
    description: '驗票模式',
    enum: VerificationMode,
    default: VerificationMode.NORMAL,
  })
  @IsOptional()
  @IsEnum(VerificationMode)
  verificationMode?: VerificationMode;

  @ApiPropertyOptional({ description: '主辦方名稱', example: '相信音樂' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  organizerName?: string;

  @ApiPropertyOptional({ description: '場地地址', example: '台北小巨蛋' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiProperty({ description: '票區列表', type: [CreateZoneDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateZoneDto)
  zones: CreateZoneDto[];
}
