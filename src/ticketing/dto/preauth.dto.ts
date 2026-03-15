import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, IsNumber, Min, IsUrl } from 'class-validator';

export class PreauthDto {
  @ApiProperty({
    description: 'User ID requesting the pre-authorization',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'Amount to pre-authorize in TWD',
    example: 1500,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({
    description: 'URL to redirect user after ECPay authorization',
    example: 'https://blocktic.app/tickets/callback',
  })
  @IsNotEmpty()
  @IsUrl()
  returnUrl: string;
}
