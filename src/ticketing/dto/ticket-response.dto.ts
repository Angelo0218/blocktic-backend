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
    description: 'ERC-1155 token ID on Polygon',
    example: '42',
  })
  tokenId: string | null;

  @ApiPropertyOptional({
    description: 'Polygon transaction hash for minting',
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

  @ApiPropertyOptional({ description: 'NFT mint timestamp' })
  mintedAt: Date | null;

  @ApiPropertyOptional({ description: 'Refund timestamp' })
  refundedAt: Date | null;

  @ApiProperty({ description: 'Ticket creation timestamp' })
  createdAt: Date;
}
