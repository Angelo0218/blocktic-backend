import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBase64, IsNotEmpty } from 'class-validator';

export class VerifyEntryDto {
  @ApiProperty({ description: 'JWT token extracted from scanned QR code' })
  @IsString()
  @IsNotEmpty()
  qrToken: string;

  @ApiPropertyOptional({
    description: 'Base64-encoded face photo for strong verification mode',
  })
  @IsOptional()
  @IsBase64()
  facePhoto?: string;

  @ApiProperty({ description: 'Physical gate identifier' })
  @IsString()
  @IsNotEmpty()
  gateId: string;

  @ApiProperty({ description: 'Staff member performing the verification' })
  @IsString()
  @IsNotEmpty()
  staffId: string;
}

export class FallbackVerifyDto {
  @ApiProperty({ description: 'Government ID number for fallback verification' })
  @IsString()
  @IsNotEmpty()
  governmentIdNumber: string;

  @ApiProperty({ description: 'Event ID' })
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @ApiProperty({ description: 'Physical gate identifier' })
  @IsString()
  @IsNotEmpty()
  gateId: string;

  @ApiProperty({ description: 'Staff member performing the verification' })
  @IsString()
  @IsNotEmpty()
  staffId: string;
}
