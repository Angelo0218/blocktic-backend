import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('draw_results')
export class DrawResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'uuid', unique: true })
  eventId: string;

  @Column({ type: 'varchar', nullable: true })
  vrfRequestId: string | null;

  @Column({ type: 'varchar', nullable: true })
  randomSeed: string | null;

  @Column({ type: 'varchar', nullable: true })
  drawProofTxHash: string | null;

  @CreateDateColumn()
  drawnAt: Date;
}
