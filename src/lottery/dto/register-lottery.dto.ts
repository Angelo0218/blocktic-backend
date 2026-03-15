import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsInt, Min, Max } from 'class-validator';

export class RegisterLotteryDto {
  @ApiProperty({
    description: 'Zone identifier the user is registering for',
    example: 'zone-A',
  })
  @IsNotEmpty()
  @IsString()
  zoneId: string;

  @ApiProperty({
    description: 'Number of people in the group (1-8)',
    example: 2,
    minimum: 1,
    maximum: 8,
  })
  @IsInt()
  @Min(1)
  @Max(8)
  groupSize: number;
}
