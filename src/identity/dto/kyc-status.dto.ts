import { ApiProperty } from '@nestjs/swagger';
import { KycStatus } from '../entities/person.entity';

export class KycStatusResponseDto {
  @ApiProperty({ description: 'User / person ID' })
  userId: string;

  @ApiProperty({ description: 'Current KYC status', enum: KycStatus })
  kycStatus: KycStatus;

  @ApiProperty({ description: 'On-chain attestation transaction hash', nullable: true })
  kycAttestationTxHash: string | null;

  @ApiProperty({ description: 'Timestamp when consent was recorded', nullable: true })
  consentRecordedAt: Date | null;

  @ApiProperty({ description: 'Record creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Record last-update timestamp' })
  updatedAt: Date;
}

export class KycSubmitResponseDto {
  @ApiProperty({ description: 'User / person ID' })
  userId: string;

  @ApiProperty({ description: 'Final KYC status after verification', enum: KycStatus })
  kycStatus: KycStatus;

  @ApiProperty({ description: 'Human-readable message describing the result' })
  message: string;
}
