import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('draw_results')
export class DrawResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
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
