import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventStatus, VerificationMode } from '../entities/event.entity';
import { ZoneResponseDto } from './zone-response.dto';

export class EventResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional() description: string | null;
  @ApiPropertyOptional() coverImage: string | null;
  @ApiProperty() startTime: Date;
  @ApiProperty() endTime: Date;
  @ApiProperty() registrationStart: Date;
  @ApiProperty() registrationEnd: Date;
  @ApiProperty({ enum: EventStatus }) status: EventStatus;
  @ApiProperty({ enum: VerificationMode }) verificationMode: VerificationMode;
  @ApiPropertyOptional() organizerName: string | null;
  @ApiPropertyOptional() address: string | null;
  @ApiProperty({ type: [ZoneResponseDto] }) zones: ZoneResponseDto[];
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
