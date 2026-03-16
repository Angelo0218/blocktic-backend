import { ApiProperty } from '@nestjs/swagger';

export class ZoneResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() eventId: string;
  @ApiProperty() name: string;
  @ApiProperty() price: number;
  @ApiProperty() depositRate: number;
  @ApiProperty() totalSeats: number;
}
