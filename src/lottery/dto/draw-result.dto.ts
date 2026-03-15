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
