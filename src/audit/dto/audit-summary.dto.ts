import { ApiProperty } from '@nestjs/swagger';

export class ActionCountDto {
  @ApiProperty({ description: 'Action type', example: 'kyc_verified' })
  action: string;

  @ApiProperty({ description: 'Number of occurrences', example: 42 })
  count: number;
}

export class AuditSummaryDto {
  @ApiProperty({ description: 'Event ID' })
  eventId: string;

  @ApiProperty({ description: 'Total number of audit log entries', example: 150 })
  totalLogs: number;

  @ApiProperty({
    description: 'Breakdown of log counts by action',
    type: [ActionCountDto],
  })
  actionCounts: ActionCountDto[];

  @ApiProperty({ description: 'Timestamp of the earliest log entry', nullable: true })
  firstLogAt: Date | null;

  @ApiProperty({ description: 'Timestamp of the latest log entry', nullable: true })
  lastLogAt: Date | null;
}
