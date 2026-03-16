import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class CreateZoneDto {
  @ApiProperty({ description: '票區名稱', example: 'VIP' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  name: string;

  @ApiProperty({ description: '票價 TWD', example: 3000, minimum: 0 })
  @IsInt()
  @Min(0)
  price: number;

  @ApiProperty({ description: '押金比例（0.0 ~ 1.0）', example: 0.4 })
  @IsNumber()
  @Min(0)
  @Max(1)
  depositRate: number;

  @ApiProperty({ description: '該區總座位數', example: 500 })
  @IsInt()
  @Min(1)
  totalSeats: number;
}
