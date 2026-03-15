import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum SeatStatus {
  AVAILABLE = 'available',
  ALLOCATED = 'allocated',
  SOLD = 'sold',
  USED = 'used',
}

@Entity('seats')
@Index(['eventId', 'zoneId', 'row', 'seatNumber'], { unique: true })
@Index(['eventId', 'zoneId', 'status'])
@Index(['ticketId'])
export class Seat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  eventId: string;

  @Column()
  zoneId: string;

  @Column()
  row: string;

  @Column({ type: 'int' })
  seatNumber: number;

  @Column({
    type: 'enum',
    enum: SeatStatus,
    default: SeatStatus.AVAILABLE,
  })
  status: SeatStatus;

  @Column({ type: 'uuid', nullable: true })
  ticketId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  allocatedAt: Date | null;
}
