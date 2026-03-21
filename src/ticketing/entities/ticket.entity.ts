import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum TicketStatus {
  PREAUTHORIZED = 'preauthorized',
  PAID = 'paid',
  MINTED = 'minted',
  REFUNDED = 'refunded',
  USED = 'used',
}

@Entity('tickets')
@Index(['eventId', 'userId'])
@Index(['eventId', 'status'])
@Index(['userId', 'status'])
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  eventId: string;

  @Column('uuid')
  userId: string;

  @Column('uuid', { nullable: true })
  seatId: string | null;

  @Column({
    type: 'enum',
    enum: TicketStatus,
    default: TicketStatus.PREAUTHORIZED,
  })
  status: TicketStatus;

  @Column({ type: 'varchar', nullable: true })
  sbtTokenId: string | null;

  @Column({ type: 'varchar', nullable: true })
  aaWalletAddress: string | null;

  @Column({ type: 'varchar', nullable: true })
  txHash: string | null;

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'varchar', nullable: true })
  preauthTradeNo: string | null;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  mintedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  refundedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
