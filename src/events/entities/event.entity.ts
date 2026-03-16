import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

import { Zone } from './zone.entity';

export enum EventStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  REGISTRATION = 'REGISTRATION',
  DRAWN = 'DRAWN',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum VerificationMode {
  STRONG = 'STRONG',
  NORMAL = 'NORMAL',
}

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  coverImage: string | null;

  @Column({ type: 'timestamptz' })
  startTime: Date;

  @Column({ type: 'timestamptz' })
  endTime: Date;

  @Column({ type: 'timestamptz' })
  registrationStart: Date;

  @Column({ type: 'timestamptz' })
  registrationEnd: Date;

  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.DRAFT })
  status: EventStatus;

  @Column({
    type: 'enum',
    enum: VerificationMode,
    default: VerificationMode.NORMAL,
  })
  verificationMode: VerificationMode;

  @Column({ type: 'varchar', length: 100, nullable: true })
  organizerName: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  address: string | null;

  @OneToMany(() => Zone, (zone) => zone.event, { cascade: true, eager: true })
  zones: Zone[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
