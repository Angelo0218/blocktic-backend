import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum LotteryEntryStatus {
  PENDING = 'pending',
  WON = 'won',
  LOST = 'lost',
}

@Entity('lottery_entries')
@Index(['eventId', 'zoneId', 'groupSize'])
@Index(['eventId', 'userId'], { unique: true })
export class LotteryEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  eventId: string;

  @Column('uuid')
  userId: string;

  @Column()
  zoneId: string;

  @Column({ type: 'int' })
  groupSize: number;

  @Column({
    type: 'enum',
    enum: LotteryEntryStatus,
    default: LotteryEntryStatus.PENDING,
  })
  status: LotteryEntryStatus;

  @Column({ type: 'varchar', nullable: true })
  drawProofTxHash: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
