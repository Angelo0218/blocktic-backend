import { ApiProperty } from '@nestjs/swagger';
import { SeatStatus } from '../entities/seat.entity';

export class SeatDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'zone-A' })
  zoneId: string;

  @ApiProperty({ example: 'A' })
  row: string;

  @ApiProperty({ example: 12 })
  seatNumber: number;

  @ApiProperty({ enum: SeatStatus, example: SeatStatus.AVAILABLE })
  status: SeatStatus;
}

export class RowSummaryDto {
  @ApiProperty({ example: 'A' })
  row: string;

  @ApiProperty({ example: 30 })
  totalSeats: number;

  @ApiProperty({ example: 22 })
  availableSeats: number;
}

export class ZoneSummaryDto {
  @ApiProperty({ example: 'zone-A' })
  zoneId: string;

  @ApiProperty({ type: [RowSummaryDto] })
  rows: RowSummaryDto[];

  @ApiProperty({ example: 150 })
  totalSeats: number;

  @ApiProperty({ example: 112 })
  availableSeats: number;
}

export class SeatMapResponseDto {
  @ApiProperty({ example: 'evt-uuid-1234' })
  eventId: string;

  @ApiProperty({ type: [ZoneSummaryDto] })
  zones: ZoneSummaryDto[];

  @ApiProperty({ example: 500 })
  totalSeats: number;

  @ApiProperty({ example: 378 })
  totalAvailable: number;
}

export class AllocationResultDto {
  @ApiProperty({
    description: 'Allocated seats',
    type: [SeatDto],
  })
  seats: SeatDto[];

  @ApiProperty({
    description: 'Allocation group identifier for these consecutive seats',
    example: 'alloc-uuid-5678',
  })
  allocationId: string;
}
