import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export interface VenueZone {
  id: string;
  name: string;
  rows: number;
  seatsPerRow: number;
}

@Entity('venues')
export class Venue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'int' })
  totalCapacity: number;

  @Column({ type: 'jsonb' })
  zones: VenueZone[];

  @CreateDateColumn()
  createdAt: Date;
}
