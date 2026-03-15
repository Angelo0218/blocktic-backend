import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AuditAction {
  KYC_VERIFIED = 'kyc_verified',
  LOTTERY_DRAWN = 'lottery_drawn',
  TICKET_MINTED = 'ticket_minted',
  TICKET_REFUNDED = 'ticket_refunded',
  GATE_VERIFIED = 'gate_verified',
  DATA_CLEANUP = 'data_cleanup',
}

@Entity('audit_logs')
@Index(['eventId', 'action'])
@Index(['eventId', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  eventId: string;

  @Column('uuid', { nullable: true })
  userId: string | null;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, any> | null;

  @Column({ type: 'varchar', nullable: true })
  ipAddress: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
