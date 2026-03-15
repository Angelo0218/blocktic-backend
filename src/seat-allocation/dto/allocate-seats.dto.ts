import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, IsInt, IsString, Min, Max } from 'class-validator';

export class AllocateSeatsDto {
  @ApiProperty({
    description: 'ID of the lottery winner requesting seats',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'Number of consecutive seats to allocate (1-8)',
    example: 3,
    minimum: 1,
    maximum: 8,
  })
  @IsInt()
  @Min(1)
  @Max(8)
  groupSize: number;

  @ApiProperty({
    description: 'Zone identifier for seat allocation',
    example: 'zone-A',
  })
  @IsNotEmpty()
  @IsString()
  zoneId: string;
}
