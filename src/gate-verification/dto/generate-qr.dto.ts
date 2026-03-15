import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class GenerateQrDto {
  @ApiProperty({ description: 'Ticket ID to generate QR code for' })
  @IsUUID()
  ticketId: string;
}
