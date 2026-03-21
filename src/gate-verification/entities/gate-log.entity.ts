import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum VerificationMode {
  STRONG = 'strong',
  NORMAL = 'normal',
  OFFLINE = 'offline',
  FALLBACK = 'fallback',
}

export enum VerificationResult {
  SUCCESS = 'success',
  FAILED = 'failed',
  FALLBACK = 'fallback',
}

@Entity('gate_logs')
@Index(['eventId', 'verifiedAt'])
@Index(['eventId', 'result', 'verifiedAt'])
@Index(['ticketId'])
export class GateLog {
  @ApiProperty({ description: 'UUID primary key' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Event ID this entry belongs to' })
  @Column('uuid')
  eventId: string;

  @ApiProperty({ description: 'Ticket ID being verified' })
  @Column('uuid')
  ticketId: string;

  @ApiProperty({ description: 'Physical gate identifier' })
  @Column({ type: 'varchar', length: 64 })
  gateId: string;

  @ApiProperty({
    description: 'Verification mode used',
    enum: VerificationMode,
  })
  @Column({ type: 'enum', enum: VerificationMode })
  verificationMode: VerificationMode;

  @ApiProperty({ description: 'Verification result', enum: VerificationResult })
  @Column({ type: 'enum', enum: VerificationResult })
  result: VerificationResult;

  @ApiProperty({ description: 'Face comparison score (0-1), null if not applicable', nullable: true })
  @Column({ type: 'real', nullable: true })
  faceScore: number | null;

  @ApiProperty({ description: 'Staff member who performed the verification' })
  @Column({ type: 'varchar', length: 64 })
  staffId: string;

  @ApiProperty({ description: 'Timestamp when verification occurred' })
  @CreateDateColumn({ type: 'timestamptz' })
  verifiedAt: Date;
}
