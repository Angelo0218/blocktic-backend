import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketStatus } from '../entities/ticket.entity';

export class TicketResponseDto {
  @ApiProperty({
    description: 'Ticket ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Event ID',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  eventId: string;

  @ApiProperty({
    description: 'User ID',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  userId: string;

  @ApiPropertyOptional({
    description: 'Assigned seat ID',
    example: '880e8400-e29b-41d4-a716-446655440000',
  })
  seatId: string | null;

  @ApiProperty({
    description: 'Current ticket status',
    enum: TicketStatus,
    example: TicketStatus.PREAUTHORIZED,
  })
  status: TicketStatus;

  @ApiPropertyOptional({
    description: 'SBT (Soulbound Token) ID on Polygon — non-transferable by users',
    example: '42',
  })
  sbtTokenId: string | null;

  @ApiPropertyOptional({
    description: "User's AA (Account Abstraction) wallet address that holds the SBT",
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  aaWalletAddress: string | null;

  @ApiPropertyOptional({
    description: 'Polygon transaction hash for SBT minting',
    example: '0xabc123...',
  })
  txHash: string | null;

  @ApiPropertyOptional({
    description: 'ECPay pre-authorization trade number',
    example: 'BT20260315001',
  })
  preauthTradeNo: string | null;

  @ApiPropertyOptional({ description: 'Payment capture timestamp' })
  paidAt: Date | null;

  @ApiPropertyOptional({ description: 'SBT mint timestamp' })
  mintedAt: Date | null;

  @ApiPropertyOptional({ description: 'Refund timestamp' })
  refundedAt: Date | null;

  @ApiProperty({ description: 'Ticket creation timestamp' })
  createdAt: Date;
}
