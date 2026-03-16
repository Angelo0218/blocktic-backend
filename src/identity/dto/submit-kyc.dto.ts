import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

/** 10MB 圖片的 base64 約 13.3M 字元 */
const MAX_IMAGE_LENGTH = 14_000_000;

export class SubmitKycDto {
  @ApiProperty({
    description: 'Base64-encoded ID card / document image (max 10MB)',
    example: '/9j/4AAQ...',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_IMAGE_LENGTH)
  idCardImage: string;

  @ApiProperty({
    description: 'Base64-encoded selfie image for liveness & face comparison (max 10MB)',
    example: '/9j/4AAQ...',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_IMAGE_LENGTH)
  selfieImage: string;

  @ApiProperty({
    description: 'User explicitly consents to biometric data processing (GDPR)',
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  consent: boolean;

  @ApiProperty({
    description: 'Existing user ID if re-submitting KYC',
    required: false,
  })
  @IsString()
  @IsOptional()
  userId?: string;
}
