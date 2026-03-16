import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '../entities/notification.entity';

export class NotificationResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty() title: string;
  @ApiProperty() body: string;
  @ApiProperty({ enum: NotificationType }) type: NotificationType;
  @ApiProperty() isRead: boolean;
  @ApiPropertyOptional() metadata: Record<string, any> | null;
  @ApiProperty() createdAt: Date;
}
