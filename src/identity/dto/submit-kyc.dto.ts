import { ApiProperty } from '@nestjs/swagger';
import { IsBase64, IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';

export class SubmitKycDto {
  @ApiProperty({
    description: 'Base64-encoded ID card / document image',
    example: 'data:image/jpeg;base64,/9j/4AAQ...',
  })
  @IsString()
  @IsNotEmpty()
  @IsBase64()
  idCardImage: string;

  @ApiProperty({
    description: 'Base64-encoded selfie image for liveness & face comparison',
    example: 'data:image/jpeg;base64,/9j/4AAQ...',
  })
  @IsString()
  @IsNotEmpty()
  @IsBase64()
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
