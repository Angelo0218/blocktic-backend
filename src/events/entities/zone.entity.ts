import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Event } from './event.entity';

@Entity('zones')
export class Zone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  eventId: string;

  @ManyToOne(() => Event, (event) => event.zones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ type: 'int' })
  price: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.4 })
  depositRate: number;

  @Column({ type: 'int' })
  totalSeats: number;
}
