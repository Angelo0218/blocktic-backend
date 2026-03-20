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

  /** 分配到的座位 UUID 陣列（抽籤時自動配位） */
  @Column({ type: 'jsonb', nullable: true })
  allocatedSeatIds: string[] | null;

  /** 人類可讀座位標籤，例如 "A 區 / B 排 / 5-8 號" */
  @Column({ type: 'varchar', nullable: true })
  allocatedSeatLabel: string | null;

  /** 是否為拆散分配（無法連號時降級為散座） */
  @Column({ type: 'boolean', default: false })
  isScattered: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
