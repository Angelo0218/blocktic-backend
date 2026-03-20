import { ApiProperty } from '@nestjs/swagger';
import { LotteryEntryStatus } from '../entities/lottery-entry.entity';

export class DrawResultEntryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  zoneId: string;

  @ApiProperty()
  groupSize: number;

  @ApiProperty({ enum: LotteryEntryStatus })
  status: LotteryEntryStatus;

  @ApiProperty({ nullable: true })
  drawProofTxHash: string | null;

  @ApiProperty({ nullable: true, type: [String], description: '分配到的座位 UUID' })
  allocatedSeatIds: string[] | null;

  @ApiProperty({ nullable: true, description: '人類可讀座位標籤' })
  allocatedSeatLabel: string | null;

  @ApiProperty({ description: '是否為拆散分配（非連號）' })
  isScattered: boolean;
}

export class DrawResultResponseDto {
  @ApiProperty()
  eventId: string;

  @ApiProperty({ nullable: true })
  vrfRequestId: string | null;

  @ApiProperty({ nullable: true })
  randomSeed: string | null;

  @ApiProperty({ nullable: true })
  drawProofTxHash: string | null;

  @ApiProperty({ nullable: true })
  drawnAt: Date | null;

  @ApiProperty({ description: '中籤人數' })
  totalWinners: number;

  @ApiProperty({ description: '未中籤人數' })
  totalLost: number;

  @ApiProperty({ type: [DrawResultEntryDto] })
  entries: DrawResultEntryDto[];
}

export class DrawProofResponseDto {
  @ApiProperty()
  eventId: string;

  @ApiProperty({ nullable: true, description: 'Chainlink VRF request ID' })
  vrfRequestId: string | null;

  @ApiProperty({ nullable: true, description: 'VRF random seed (hex)' })
  randomSeed: string | null;

  @ApiProperty({ nullable: true, description: 'Polygon transaction hash of draw proof' })
  drawProofTxHash: string | null;

  @ApiProperty({ nullable: true })
  drawnAt: Date | null;
}
