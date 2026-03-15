import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum KycStatus {
  PENDING = 'PENDING',
  ID_VERIFIED = 'ID_VERIFIED',
  LIVENESS_PASSED = 'LIVENESS_PASSED',
  FACE_MATCHED = 'FACE_MATCHED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('persons')
export class Person {
  @ApiProperty({ description: 'UUID primary key' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'SHA-256 hash of the ID document for uniqueness check' })
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, unique: true, nullable: true })
  personIdHash: string | null;

  @ApiProperty({ description: 'Current KYC verification status', enum: KycStatus })
  @Column({ type: 'enum', enum: KycStatus, default: KycStatus.PENDING })
  kycStatus: KycStatus;

  @ApiProperty({ description: 'Reference ID for the face embedding stored in CompreFace' })
  @Column({ type: 'varchar', length: 255, nullable: true })
  faceEmbeddingRef: string | null;

  @ApiProperty({ description: 'ERC-4337 Account Abstraction smart contract wallet address', nullable: true })
  @Column({ type: 'varchar', length: 42, nullable: true })
  aaWalletAddress: string | null;

  @ApiProperty({ description: 'On-chain transaction hash of the KYC attestation' })
  @Column({ type: 'varchar', length: 66, nullable: true })
  kycAttestationTxHash: string | null;

  @ApiProperty({ description: 'Timestamp when user consent was recorded (GDPR)' })
  @Column({ type: 'timestamptz', nullable: true })
  consentRecordedAt: Date | null;

  @ApiProperty({ description: 'Record creation timestamp' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ description: 'Record last-update timestamp' })
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
